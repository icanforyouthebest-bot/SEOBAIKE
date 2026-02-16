$base = "http://localhost:9999"
$pages = @(
    "/nvidia-chat.html",
    "/pages-site/dashboard.html",
    "/pages-site/index.html",
    "/pages-site/ecosystem.html",
    "/pages-site/ai.html",
    "/pages-site/marketplace.html",
    "/pages-site/status.html",
    "/pages-site/billing.html",
    "/pages-site/compliance.html",
    "/pages-site/features.html",
    "/pages-site/pricing.html",
    "/pages-site/marketing.html",
    "/pages-site/bots.html",
    "/pages-site/login.html",
    "/pages-site/start.html",
    "/pages-site/about.html",
    "/pages-site/contact.html",
    "/pages-site/blog.html",
    "/pages-site/docs.html",
    "/pages-site/privacy.html",
    "/pages-site/terms.html",
    "/chat.html",
    "/command-center.html",
    "/dashboard.html"
)
foreach ($p in $pages) {
    Start-Process "$base$p"
    Start-Sleep -Milliseconds 500
}
Write-Host "All 24 pages opened."
