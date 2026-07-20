import db, { schema } from "./db";
import env from "./env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { apiKeysPlugin } from "./plugins/api-keys";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { Resend } from "resend";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const polarClient = env.POLAR_ACCESS_TOKEN
  ? new Polar({
      accessToken: env.POLAR_ACCESS_TOKEN,
    })
  : null;

export default betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url, token }, request) {
      if (resend) {
        await resend.emails.send({
          from: env.FROM_EMAIL || "onboarding@resend.dev",
          to: user.email,
          subject: "Reset your password",
          html: `<p>Click <a href="${url}">here</a> to reset your password.</p>`,
        });
      }
    },
  },
  emailVerification: {
    async sendVerificationEmail({ user, url, token }, request) {
      if (resend) {
        await resend.emails.send({
          from: env.FROM_EMAIL || "onboarding@resend.dev",
          to: user.email,
          subject: "Verify your email",
          html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
        });
      }
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    organization({
      async sendInvitationEmail({ email, invitation, organization }) {
        if (resend) {
          const inviteUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/invite/${invitation.id}`;
          await resend.emails.send({
            from: env.FROM_EMAIL || "onboarding@resend.dev",
            to: email,
            subject: `You're invited to join ${organization.name}`,
            html: `<p>Click <a href="${inviteUrl}">here</a> to accept the invitation to join ${organization.name}.</p>`,
          });
        }
      },
    }),
    ...(polarClient
      ? [
          polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            use: [
              checkout({
                successUrl: `${env.FRONTEND_URL}/dashboard?checkout_id={CHECKOUT_ID}`,
                authenticatedUsersOnly: true,
              }),
              portal(),
              webhooks({
                secret: env.POLAR_WEBHOOK_SECRET || "",
              }),
            ],
          }),
        ]
      : []),
    apiKeysPlugin(),
  ],
  basePath: "/auth",
});
