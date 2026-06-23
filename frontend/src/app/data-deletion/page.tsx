export const metadata = { title: 'Data Deletion – Celestia' };

export default function DataDeletion() {
  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.header}>
          <div style={s.logo}>✦</div>
          <h1 style={s.title}>Data Deletion Instructions</h1>
          <p style={s.sub}>Celestia · How to request removal of your data</p>
        </div>

        <div style={s.card}>
          <h2 style={s.sectionTitle}>If you logged in with Facebook</h2>
          <p style={s.body}>
            If you used Facebook Login to create your Celestia account and wish to
            have your data removed, you have two options:
          </p>

          <div style={s.step}>
            <div style={s.stepNum}>1</div>
            <div>
              <strong style={s.stepTitle}>Remove access from Facebook</strong>
              <p style={s.stepBody}>
                Go to your Facebook account → <strong>Settings &amp; Privacy</strong> →
                <strong> Settings</strong> → <strong>Apps and Websites</strong> →
                find <strong>Celestia</strong> → click <strong>Remove</strong>.
                This revokes Celestia&apos;s access to your Facebook account.
              </p>
            </div>
          </div>

          <div style={s.step}>
            <div style={s.stepNum}>2</div>
            <div>
              <strong style={s.stepTitle}>Request full data deletion from Celestia</strong>
              <p style={s.stepBody}>
                Send an email to{' '}
                <a href="mailto:escanorsinofpride3@gmail.com" style={s.link}>
                  escanorsinofpride3@gmail.com
                </a>{' '}
                with the subject line <strong>&quot;Data Deletion Request&quot;</strong> and
                include the email address associated with your Celestia account.
                We will permanently delete your account, profile, posts, comments,
                messages, and all associated data within <strong>30 days</strong>.
              </p>
            </div>
          </div>
        </div>

        <div style={s.card}>
          <h2 style={s.sectionTitle}>What data we delete</h2>
          <p style={s.body}>Upon a confirmed deletion request, we remove:</p>
          <ul style={s.list}>
            <li>Your account and login credentials</li>
            <li>Your profile information (display name, bio, avatar, birthday, zodiac sign)</li>
            <li>All verses and comments you have posted</li>
            <li>All messages and conversations</li>
            <li>Your reactions and follow relationships</li>
          </ul>
          <p style={s.body}>
            Note: Content you shared may have been seen or saved by other users before deletion.
            We cannot guarantee removal of copies made outside our platform.
          </p>
        </div>

        <div style={s.card}>
          <h2 style={s.sectionTitle}>Contact</h2>
          <p style={s.body}>
            For any questions about your data, reach us at{' '}
            <a href="mailto:escanorsinofpride3@gmail.com" style={s.link}>
              escanorsinofpride3@gmail.com
            </a>.
            We respond to all requests within 5 business days.
          </p>
        </div>

        <div style={s.back}>
          <a href="/" style={s.link}>← Back to Celestia</a>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: '#0d0b09', color: '#e8dcc8',
    fontFamily: "'DM Sans', sans-serif", padding: '3rem 1.5rem',
  },
  wrap: { maxWidth: '740px', margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid rgba(201,168,76,.15)' },
  logo: { fontSize: '2rem', color: '#c9a84c', marginBottom: '.75rem' },
  title: { fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', color: '#e8dcc8', marginBottom: '.4rem' },
  sub: { fontSize: '.82rem', color: '#7a6f5a' },
  card: {
    background: 'rgba(26,21,16,.8)', border: '1px solid rgba(201,168,76,.12)',
    borderRadius: '14px', padding: '1.75rem', marginBottom: '1.25rem',
  },
  sectionTitle: { fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#c9a84c', marginBottom: '1rem' },
  body: { fontSize: '.9rem', lineHeight: 1.75, color: '#b5a98a', marginBottom: '.75rem' },
  list: { fontSize: '.9rem', lineHeight: 2, color: '#b5a98a', paddingLeft: '1.5rem', marginBottom: '.75rem' },
  step: { display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.25rem' },
  stepNum: {
    minWidth: '28px', height: '28px', borderRadius: '50%',
    background: 'linear-gradient(135deg,#c9a84c,#8b6914)', color: '#1a1510',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '.78rem', fontWeight: 700, flexShrink: 0, marginTop: '2px',
  },
  stepTitle: { color: '#e8dcc8', display: 'block', marginBottom: '.35rem', fontSize: '.92rem' },
  stepBody: { fontSize: '.88rem', lineHeight: 1.7, color: '#b5a98a' },
  link: { color: '#c9a84c', textDecoration: 'underline' },
  back: { marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid rgba(201,168,76,.15)', textAlign: 'center' as const },
};
