export const metadata = { title: 'Terms of Service – Celestia' };

export default function TermsOfService() {
  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.header}>
          <div style={s.logo}>✦</div>
          <h1 style={s.title}>Terms of Service</h1>
          <p style={s.sub}>Celestia · Last updated June 23, 2025</p>
        </div>

        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using Celestia (&quot;the Platform&quot;), you agree to be bound by
            these Terms of Service. If you do not agree, please do not use the Platform.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be at least 13 years old to use Celestia. By creating an account,
            you confirm you meet this requirement.
          </p>
        </Section>

        <Section title="3. User Accounts">
          <ul>
            <li>You are responsible for maintaining the security of your account</li>
            <li>You must not share your login credentials with others</li>
            <li>You must provide accurate information when registering</li>
            <li>One account per person — duplicate accounts may be removed</li>
          </ul>
        </Section>

        <Section title="4. User Content">
          <p>
            You retain ownership of the verses, comments, and other content you post on Celestia.
            By posting content, you grant Celestia a non-exclusive, royalty-free license to
            display and distribute that content within the Platform.
          </p>
          <p>You agree not to post content that:</p>
          <ul>
            <li>Is unlawful, harmful, threatening, or harassing</li>
            <li>Infringes on intellectual property rights of others</li>
            <li>Contains spam, malware, or deceptive information</li>
            <li>Violates the privacy of others</li>
          </ul>
        </Section>

        <Section title="5. Social Login">
          <p>
            Celestia offers login via Facebook and GitHub. Use of these features is also
            subject to the respective provider&apos;s terms of service. We are not responsible
            for the practices of these third-party providers.
          </p>
        </Section>

        <Section title="6. Prohibited Conduct">
          <ul>
            <li>Attempting to access other users&apos; accounts without authorization</li>
            <li>Reverse engineering or scraping the Platform</li>
            <li>Using the Platform to distribute unsolicited messages (spam)</li>
            <li>Impersonating another person or entity</li>
          </ul>
        </Section>

        <Section title="7. Termination">
          <p>
            We reserve the right to suspend or terminate accounts that violate these Terms,
            at our sole discretion, with or without notice. You may also delete your account
            at any time by contacting us.
          </p>
        </Section>

        <Section title="8. Disclaimer of Warranties">
          <p>
            Celestia is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
            uninterrupted or error-free service. Use of the Platform is at your own risk.
          </p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>
            To the fullest extent permitted by law, Celestia shall not be liable for any
            indirect, incidental, or consequential damages arising from your use of the Platform.
          </p>
        </Section>

        <Section title="10. Changes to Terms">
          <p>
            We may update these Terms at any time. Continued use of Celestia after changes
            constitutes acceptance of the new Terms.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            For questions about these Terms, contact us at{' '}
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
