function PolicySection({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export default function CookiePolicyPage() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 md:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Cookie Policy
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          This page explains how QLTracker uses cookies and similar browser
          storage such as localStorage and sessionStorage.
        </p>
      </header>

      <PolicySection title="Current Approach">
        <p>
          QLTracker currently uses a limited set of first-party cookies and
          browser storage mechanisms for authentication, security, and
          user-requested preferences.
        </p>
        <p>
          QLTracker does not currently use advertising cookies, tracking pixels,
          or marketing cookies.
        </p>
      </PolicySection>

      <PolicySection title="Strictly Necessary Cookies">
        <p>
          Some cookies are used to keep the service secure and working
          correctly. These may include authentication and session cookies used
          for pickup sign-in and related protected features.
        </p>
        <p>
          Example: <code>qltracker-pickup-session</code> is used to maintain a
          signed-in pickup session. It is a first-party cookie, set with
          security attributes such as <code>HttpOnly</code>,{" "}
          <code>SameSite</code>, and <code>Secure</code> where applicable, and
          can remain active for up to 90 days unless cleared earlier by logout
          or expiry.
        </p>
      </PolicySection>

      <PolicySection title="Preference Cookies">
        <p>
          QLTracker also uses first-party preference cookies to remember
          user-requested interface settings.
        </p>
        <p>
          Examples include <code>theme</code> and <code>theme-resolved</code>,
          which remember your selected display theme for up to 1 year, and{" "}
          <code>sidebar_state</code>, which remembers whether the sidebar is
          expanded or collapsed for up to 7 days.
        </p>
      </PolicySection>

      <PolicySection title="Local Storage and Session Storage">
        <p>
          QLTracker also stores some data directly in your browser using
          localStorage or sessionStorage. This is used for features you
          explicitly use inside the app.
        </p>
        <p>Examples may include:</p>
        <p>
          theme preference, favorite servers, tracked players and notes, pickup
          session state, guest mode state, filter and language preferences,
          notice dismissals, last visited in-app path, and any server passwords
          you choose to save locally on your own device.
        </p>
        <p>
          Saved server passwords stored this way are kept locally in your
          browser and are not needed for general browsing of the site.
        </p>
      </PolicySection>

      <PolicySection title="Third-Party Cookies">
        <p>
          If you use Steam sign-in, Steam may set its own cookies on Steam-owned
          domains as part of the authentication process. Those cookies are
          governed by Steam’s own policies, not this site’s first-party cookie
          policy.
        </p>
      </PolicySection>

      <PolicySection title="European Compliance">
        <p>
          Under the standard EU approach, strictly necessary cookies used for
          authentication or technical operation do not generally require prior
          consent, while non-essential cookies usually do.
        </p>
        <p>
          If QLTracker later adds analytics cookies, advertising cookies,
          tracking technologies, or non-essential third-party embeds, those
          technologies should not be set until the user has given clear prior
          consent.
        </p>
        <p>
          To stay on the safer side of EU compliance, this policy should always
          match the actual cookies and storage technologies in use, and any
          future non-essential tools should be paired with a proper consent
          mechanism.
        </p>
      </PolicySection>

      <PolicySection title="Updates">
        <p>
          This policy can be updated as QLTracker evolves. If the app’s cookie
          usage changes, this page should be updated at the same time.
        </p>
      </PolicySection>

      <div className="border-t border-border pt-6 text-sm text-muted-foreground">
        For cookie or privacy inquiries, contact{" "}
        <a
          className="font-medium text-foreground underline underline-offset-4"
          href="mailto:contact@qltracker.com"
        >
          contact@qltracker.com
        </a>
        .
      </div>
    </section>
  )
}
