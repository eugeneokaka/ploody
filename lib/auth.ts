import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { google } from "better-auth/social-providers";
import { Resend } from "resend";
import prisma from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY!);

const verificationEmailHtml = (name: string, url: string) => `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 0">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #ededed;border-radius:12px;overflow:hidden">
          <tr>
            <td style="padding:32px 40px 0">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px;height:36px;background:#facc15;border-radius:8px;text-align:center;vertical-align:middle">
                    <span style="font-size:18px;color:#1a1a1a">&#9998;</span>
                  </td>
                  <td style="padding-left:10px;font-size:20px;font-weight:700;color:#1a1a1a">Ploody</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 0;font-size:22px;font-weight:600;color:#1a1a1a">Verify your email</td>
          </tr>
          <tr>
            <td style="padding:8px 40px 24px;font-size:15px;line-height:1.6;color:#666666">
              Hi ${name},<br><br>
              Click the button below to verify your email and start using Ploody.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 40px 32px">
              <a href="${url}" style="display:inline-block;background:#facc15;color:#1a1a1a;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px">
                Verify Email
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;font-size:13px;color:#999999;line-height:1.5">
              If you didn't create an account, you can ignore this email.<br>
              Or copy this link: <a href="${url}" style="color:#999999">${url}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #ededed;font-size:12px;color:#bbbbbb">
              Ploody &middot; A beautiful notes app
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

function sendVerificationEmail({ user, url }: { user: { name: string; email: string }; url: string }) {
  return resend.emails
    .send({
      from: "Ploody <noreply@mail.eugenecode.xyz>",
      to: user.email,
      subject: "Verify your email",
      html: verificationEmailHtml(user.name, url),
    })
    .then(() => {});
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendVerificationEmail,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  trustedOrigins: ["http://localhost:3000"],
  plugins: [nextCookies()],
});
