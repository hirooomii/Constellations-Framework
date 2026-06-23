export const metadata = { title: 'Privacy Policy – Celestia' };

export default function PrivacyPolicy() {
  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.header}>
          <div style={s.logo}>✦</div>
          <h1 style={s.title}>Privacy Policy</h1>
          <p style={s.sub}>Celestia · Last updated June 23, 2025</p>
        </div>

        <Section title="1. Information We Collect">
          <p>When you create an account or log in via a social provider (Facebook, GitHub), we collect:</p>
          <ul>
            <li>Your name and email address provided by the social provider</li>
            <li>Your profile photo (if shared by the provider)</li>
            <li>A username generated from your profile information</li>
            <li>Content you create on Celestia (verses, comments, reactions)</li>
            <li>Messages you send to other users</li>
          </ul>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul>
            <li>To create and manage your Celestia account</li>
            <li>To display your profile and content to other users</li>
            <li>To enable features such as messaging, reactions, and notifications</li>
            <li>To improve the platform and fix issues</li>
          </ul>
          <p>We do not sell your personal information to third parties.</p>
        </Section>

        <Section title="3. Social Login (Facebook / GitHub)">
          <p>
            When you sign in via Facebook or GitHub, we receive only the basic profile
            information that you authorize. We do not post to your social accounts or
            access your friends list. The social provider&apos;s own privacy policy also
            applies to data shared through their platform.
          </p>
        </Section>

        <Section title="4. Data Storage">
          <p>
            Your data is stored securely in Supabase (PostgreSQL). We use industry-standard
            security practices including encrypted connections and access controls. We retain
            your data for as long as your account is active.
          </p>
        </Section>

        <Section title="5. Data Sharing">
          <p>We share data only in the following limited cases:</p>
          <ul>
            <li>With Supabase as our database and authentication provider</li>
            <li>With Cloudinary for profile photo storage</li>
            <li>When required by law or to protect the rights of Celestia users</li>
          </ul>
        </Section>

        <Section title="6. Your Rights">
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent for social login at any time via your provider settings</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:escanorsinofpride3@gmail.com" style={s.link}>
              escanorsinofpride3@gmail.com
            </a>.
          </p>
        </Section>

        <Section title="7. Cookies">
          <p>
            Celestia uses localStorage (not cookies) to maintain your login session.
            No third-party tracking cookies are used.
          </p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p>
            We may update this policy from time to time. Continued use of Celestia
            after changes constitutes acceptance of the updated policy.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            For privacy-related questions, contact us at{' '}
            <a href="mailto:escanorsinofpride3@gmail.com" style={s.link}>
              escanorsinofpride3@gmail.com
            </a>.
          </p>
        </Section>

        <div style={s.back}>
          <a href="/" style={s.link}>← Back to Celestia</a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={s.sectionTitle}>{title}</h2>
      <div style={s.body}>{children}</div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: '#0d0b09', color: '#e8dcc8',
    fontFamily: "'DM Sans', sans-serif", padding: '3rem 1.5rem',
  },
  wrap: { maxWidth: '740px', margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: '3rem', paddingBottom: '2rem', borderBottom: '1px solid rgba(201,168,76,.15)' },
  logo: { fontSize: '2rem', color: '#c9a84c', marginBottom: '.75rem' },
  title: { fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', color: '#e8dcc8', marginBottom: '.4rem' },
  sub: { fontSize: '.82rem', color: '#7a6f5a' },
  sectionTitle: { fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#c9a84c', marginBottom: '.6rem' },
  body: { fontSize: '.9rem', lineHeight: 1.75, color: '#b5a98a' },
  link: { color: '#c9a84c', textDecoration: 'underline' },
  back: { marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid rgba(201,168,76,.15)', textAlign: 'center' as const },
};
