import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function calculateCommission(
  merchantId: string,
  orderId: string,
  amountCents: number
) {
  const { data: rule } = await supabase
    .from("commission_rules")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!rule) return { commission: 0, net: amountCents };

  let commission = 0;
  if (rule.type === "percentage" && rule.percentage_bp != null) {
    commission = Math.floor((amountCents * rule.percentage_bp) / 10000);
  } else if (rule.type === "fixed" && rule.fixed_cents != null) {
    commission = rule.fixed_cents;
  }

  if (rule.max_cents != null) commission = Math.min(commission, rule.max_cents);
  if (rule.min_cents != null) commission = Math.max(commission, rule.min_cents);

  const net = amountCents - commission;
  return { commission, net };
}

async function detectAntiKickback(
  merchantId: string,
  orderId: string,
  amountCents: number
) {
  const { data: recent, error } = await supabase
    .from("orders")
    .select("id, total_cents, created_at")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !recent) return null;

  const avg =
    recent.reduce((sum: number, o: any) => sum + (o.total_cents ?? 0), 0) /
    Math.max(recent.length, 1);

  const ratio = amountCents / Math.max(avg, 1);
  if (ratio > 5) {
    const { data: pattern } = await supabase
      .from("anti_kickback_patterns")
      .insert({
        merchant_id: merchantId,
        pattern_type: "abnormal_commission",
        description: "order_amount_much_higher_than_recent_average",
        score: Math.min(Math.round(ratio * 10), 100),
        metadata: { order_id: orderId, amount_cents: amountCents, avg_recent: avg }
      })
      .select()
      .single();

    return pattern;
  }

  return null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const body = await req.json();
  const { payment_id } = body;

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("*, orders(merchant_id)")
    .eq("id", payment_id)
    .single();

  if (payErr || !payment) {
    return new Response(JSON.stringify({ error: "payment_not_found" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (payment.status !== "captured") {
    return new Response(JSON.stringify({ error: "payment_not_captured" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const merchantId = payment.orders.merchant_id;
  const orderId = payment.order_id;
  const amountCents = payment.amount_cents;

  // 抽佣計算
  const { commission, net } = await calculateCommission(
    merchantId,
    orderId,
    amountCents
  );

  // 反傭偵測
  const pattern = await detectAntiKickback(merchantId, orderId, amountCents);

  let payoutStatus = "scheduled";
  let reasonBlocked: string | null = null;

  if (pattern && pattern.score >= 70) {
    payoutStatus = "blocked";
    reasonBlocked = "anti_kickback_pattern_detected";
  }

  await supabase
    .from("commission_payouts")
    .update({
      commission_cents: commission,
      net_cents: net,
      status: payoutStatus,
      reason_blocked: reasonBlocked
    })
    .eq("merchant_id", merchantId)
    .eq("order_id", orderId);

  if (payoutStatus === "blocked") {
    await supabase.from("risk_flags").insert({
      merchant_id: merchantId,
      type: "commission_risk",
      severity: "high",
      source: "system",
      description: "anti_kickback_pattern_detected_on_payment_captured",
      metadata: { payment_id, order_id: orderId, pattern_id: pattern!.id }
    });
  }

  await supabase.from("audit_logs").insert({
    action: "payment_captured_processed",
    target_type: "payment",
    target_id: payment_id,
    metadata: {
      commission_cents: commission,
      net_cents: net,
      payout_status: payoutStatus
    }
  });

  return new Response(JSON.stringify({ status: "ok", commission_cents: commission, net_cents: net, payout_status: payoutStatus }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
