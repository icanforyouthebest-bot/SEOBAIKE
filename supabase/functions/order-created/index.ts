import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req: Request): Promise<Response> => {
  const body = await req.json();
  const { order_id } = body;

  // 1. 取得訂單與商家
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*, merchants(*)")
    .eq("id", order_id)
    .single();

  if (orderErr || !order) {
    console.error(orderErr);
    return new Response(JSON.stringify({ error: "order_not_found" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const merchantId = order.merchant_id;

  // 2. 觸發基本合規檢查（KYC 狀態、風險標記）
  const { data: merchant, error: merchantErr } = await supabase
    .from("merchants")
    .select("id, kyc_status")
    .eq("id", merchantId)
    .single();

  if (merchantErr || !merchant) {
    return new Response(JSON.stringify({ error: "merchant_not_found" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (merchant.kyc_status !== "active") {
    await supabase.from("compliance_checks").insert({
      merchant_id: merchantId,
      order_id,
      check_type: "kyc",
      status: "failed",
      details: { reason: "merchant_not_active" }
    });

    await supabase.from("audit_logs").insert({
      action: "order_blocked_due_to_kyc",
      target_type: "order",
      target_id: order_id,
      metadata: { merchant_kyc_status: merchant.kyc_status }
    });

    return new Response(JSON.stringify({ error: "order_blocked_kyc" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 3. 建立抽佣計算預備紀錄（實際金額在付款成功後計算）
  await supabase.from("commission_payouts").insert({
    merchant_id: merchantId,
    order_id,
    gross_cents: order.total_cents,
    commission_cents: 0,
    net_cents: 0,
    status: "pending"
  });

  await supabase.from("audit_logs").insert({
    action: "order_created_processed",
    target_type: "order",
    target_id: order_id,
    metadata: {}
  });

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
