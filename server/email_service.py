import os
import base64
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException


def _load_bg_image_base64() -> str:
    """Load the email background image and return as base64 data URL."""
    assets_dir = os.path.join(os.path.dirname(__file__), "assets")
    for fname in ("email_bg.jpg", "email_bg.jpeg", "email_bg.png", "email_bg.webp"):
        path = os.path.join(assets_dir, fname)
        if os.path.exists(path):
            ext = fname.rsplit(".", 1)[-1].lower()
            mime = "jpeg" if ext in ("jpg", "jpeg") else ext
            with open(path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            return f"data:image/{mime};base64,{b64}"
    return ""  # No image found — falls back to dark background gracefully


def _build_html(recipient_name: str, bg_data_url: str) -> str:
    # If we have an image, use it; otherwise use a solid dark gradient background
    if bg_data_url:
        hero_bg = (
            f"background-image: url('{bg_data_url}'); "
            "background-size: cover; background-position: center center;"
        )
        # Vignette: radial gradient darkens edges, light translucent centre
        overlay_bg = (
            "background: linear-gradient("
            "to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.30) 40%, rgba(0,0,0,0.72) 100%),"
            "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.60) 100%);"
        )
    else:
        hero_bg = "background: linear-gradient(160deg, #0A0F1A 0%, #111C2E 100%);"
        overlay_bg = "background: transparent;"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to PLANORA</title>
</head>
<body style="margin:0;padding:0;background-color:#060B12;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
         style="background-color:#060B12;">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <!-- Card: max 600px -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
               style="max-width:600px;width:100%;border-radius:4px;overflow:hidden;">

          <!-- ── HERO SECTION: full image + vignette + all content ── -->
          <tr>
            <td style="padding:0;">
              <div style="position:relative;{hero_bg}min-height:560px;">

                <!-- Vignette overlay -->
                <div style="position:absolute;top:0;left:0;right:0;bottom:0;{overlay_bg}"></div>

                <!-- Content sits above the overlay via position:relative + z-index -->
                <div style="position:relative;z-index:1;text-align:center;padding:72px 48px 64px;">

                  <!-- Brand label -->
                  <p style="
                    margin:0 0 36px 0;
                    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    font-size:10px;
                    font-weight:600;
                    letter-spacing:6px;
                    color:rgba(255,255,255,0.50);
                    text-transform:uppercase;
                  ">PLANORA &nbsp;/&nbsp; WELCOME</p>

                  <!-- Main headline -->
                  <h1 style="
                    margin:0;
                    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    font-size:46px;
                    font-weight:700;
                    line-height:1.08;
                    letter-spacing:-1.5px;
                    color:#FFFFFF;
                    text-shadow:0 4px 24px rgba(0,0,0,0.6);
                  ">YOUR SPACE<br>AWAITS.</h1>

                  <!-- Cyan accent rule -->
                  <div style="
                    width:36px;
                    height:2px;
                    background-color:#56C7FF;
                    margin:28px auto 28px;
                  "></div>

                  <!-- Personalised greeting -->
                  <p style="
                    margin:0 0 12px 0;
                    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    font-size:17px;
                    font-weight:300;
                    letter-spacing:0.5px;
                    color:rgba(255,255,255,0.92);
                  ">Hi {recipient_name},</p>

                  <!-- Body copy -->
                  <p style="
                    margin:0 0 40px 0;
                    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    font-size:14px;
                    font-weight:300;
                    line-height:1.80;
                    color:rgba(255,255,255,0.72);
                    max-width:380px;
                    margin-left:auto;
                    margin-right:auto;
                  ">
                    Your PLANORA account is live and ready.<br>
                    Design intelligent spaces, generate optimised floor&nbsp;plans,<br>
                    validate layouts — and explore it all in 3D.
                  </p>

                  <!-- CTA button -->
                  <a href="#"
                     style="
                       display:inline-block;
                       background-color:#56C7FF;
                       color:#060B12;
                       font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                       font-size:11px;
                       font-weight:700;
                       letter-spacing:3.5px;
                       text-decoration:none;
                       text-transform:uppercase;
                       padding:16px 44px;
                       border-radius:2px;
                     ">GET STARTED &nbsp;→</a>

                  <!-- Footer inside hero -->
                  <p style="
                    margin:56px 0 0 0;
                    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                    font-size:10px;
                    letter-spacing:3px;
                    color:rgba(255,255,255,0.30);
                    text-transform:uppercase;
                  ">Team PLANORA &nbsp;·&nbsp; AI-Powered Space Design</p>

                </div><!-- /content -->
              </div><!-- /hero -->
            </td>
          </tr>

          <!-- ── BOTTOM BAR ── -->
          <tr>
            <td style="
              background-color:#06090F;
              padding:20px 40px;
              text-align:center;
              border-top:1px solid rgba(86,199,255,0.10);
            ">
              <p style="
                margin:0;
                font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                font-size:10px;
                letter-spacing:2px;
                color:rgba(255,255,255,0.18);
                text-transform:uppercase;
              ">© 2026 PLANORA &nbsp;·&nbsp; You received this email because you created an account.</p>
            </td>
          </tr>

        </table><!-- /card -->

      </td>
    </tr>
  </table><!-- /outer -->

</body>
</html>"""


def send_welcome_email(recipient_email: str, recipient_name: str):

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key["api-key"] = os.getenv("BREVO_API_KEY")

    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
        sib_api_v3_sdk.ApiClient(configuration)
    )

    sender = {
        "name": os.getenv("BREVO_SENDER_NAME"),
        "email": os.getenv("BREVO_SENDER_EMAIL"),
    }

    recipient = [{"email": recipient_email, "name": recipient_name}]

    bg_data_url = _load_bg_image_base64()
    html_content = _build_html(recipient_name, bg_data_url)

    email = sib_api_v3_sdk.SendSmtpEmail(
        sender=sender,
        to=recipient,
        subject="Welcome to PLANORA — Your Space Awaits",
        html_content=html_content,
    )

    try:
        api_instance.send_transac_email(email)
        return True, "Welcome email sent successfully"

    except ApiException as e:
        print("Brevo error:", e)
        return False, str(e)