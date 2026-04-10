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

export default function PrivacyPolicyPage() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 md:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          This page explains what QLTracker stores, how Steam sign-in works, and
          what data QLTracker does not access.
        </p>
      </header>

      <PolicySection title="How Steam Sign-In Works">
        <p>
          QLTracker uses Steam OpenID for sign-in. That means the Steam login
          form is handled by Steam, not by QLTracker.
        </p>
        <p>
          When you sign in, Steam confirms your identity and returns your
          SteamID. QLTracker then requests a limited public profile summary from
          Steam so the app can display your account correctly.
        </p>
      </PolicySection>

      <PolicySection title="Steam Data We Access">
        <p>For Steam-linked pickup accounts, QLTracker uses only:</p>
        <p>
          your SteamID, your public persona name, your public avatar image URL,
          and your public Steam profile URL.
        </p>
        <p>
          This data is used to identify your pickup account, show your name and
          avatar in the app, link to your public profile, and keep your pickup
          profile up to date.
        </p>
      </PolicySection>

      <PolicySection title="Steam Data We Do Not Access">
        <p>
          QLTracker does not see, collect, or store your Steam password because
          you do not enter it into QLTracker.
        </p>
        <p>QLTracker does not access or store your:</p>
        <p>
          Steam inventory, items, wallet, payment details, trade history, email
          address, friends list, private profile data, or game purchase data.
        </p>
        <p>
          QLTracker also does not perform trades, move items, or interact with
          your Steam account beyond identity verification and public profile
          lookup.
        </p>
      </PolicySection>

      <PolicySection title="Data We Store">
        <p>Depending on which features you use, QLTracker may store:</p>
        <p>
          favorite servers, tracked players, local app preferences, pickup
          account records, pickup profile data, queue and match participation,
          ratings, match results, and server or gameplay metadata related to the
          pickup system.
        </p>
        <p>
          For Steam-linked pickup accounts, stored account data can include your
          SteamID, persona name, Steam avatar URL, Steam profile URL, last login
          timestamp, and any optional custom profile media you upload yourself.
        </p>
      </PolicySection>

      <PolicySection title="Sessions and Authentication">
        <p>
          QLTracker creates session tokens so signed-in users can stay logged in
          to the app. The server stores hashed session records, and the browser
          may store session data needed for the pickup experience.
        </p>
      </PolicySection>

      <PolicySection title="How Data Is Used">
        <p>
          Stored data is used to operate the app, render profiles, run the
          pickup system, calculate ratings, display match history and stats, and
          keep the service reliable and secure.
        </p>
      </PolicySection>

      <PolicySection title="Third-Party Services">
        <p>
          QLTracker relies on third-party services where needed, including Steam
          for identity verification and public profile data. Other service
          providers may process limited technical data required to host, secure,
          and deliver the app.
        </p>
      </PolicySection>

      <PolicySection title="Updates">
        <p>
          This policy can be updated as QLTracker evolves. If your final legal
          wording needs to be stricter or more formal, replace this copy before
          using it as production legal text.
        </p>
      </PolicySection>

      <div className="border-t border-border pt-6 text-sm text-muted-foreground">
        For privacy inquiries, contact{" "}
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
