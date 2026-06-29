import { Nav } from "@/components/shared/Nav";

export const metadata = {
  title: "Privacy",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-xl font-medium tracking-[-0.02em] text-[var(--color-fg-0)]">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 leading-relaxed">{children}</p>;
}

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12 text-[var(--color-fg-1)]">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-2)]">
          Legal · Privacy
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-[var(--color-fg-0)]">
          Privacy policy
        </h1>
        <p className="mt-2 font-mono text-xs text-[var(--color-fg-2)]">Last updated: 2026-06-12</p>

        <P>
          This policy explains what data [APP_NAME] handles when you use [YOUR_DOMAIN] and the Telegram
          mini app, where it goes, and what your choices are. [APP_NAME] is a self-custodial interface:
          we never hold your funds or keys, and we collect as little as the product allows.
        </P>

        <H2>1. What we collect</H2>
        <P>We handle the following, and nothing beyond it:</P>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed">
          <li>
            Your wallet address, when you connect a wallet. Addresses are pseudonymous but can be
            linked to you through your onchain history.
          </li>
          <li>
            Transaction and signature metadata: the orders you build, the quotes you request, and
            the signatures you authorize, as needed to relay them to the venues you chose.
          </li>
          <li>
            Standard server logs: IP address, user agent, and request paths, recorded by our hosting
            provider (Railway) for abuse prevention and debugging.
          </li>
          <li>
            Email address or social account identifiers, only if you choose to log in through Privy.
            Privy processes authentication on our behalf under its own privacy policy. If you
            connect an external wallet directly, we never see an email.
          </li>
          <li>
            Telegram context (your Telegram user ID and display name), only if you open the Telegram
            mini app, provided by Telegram's web app platform.
          </li>
        </ul>
        <P>
          We do not collect names, government IDs, or payment details. There is no KYC on the
          Interface itself; underlying venues or payment platforms may have their own requirements.
        </P>

        <H2>2. What goes to third-party venues</H2>
        <P>
          To fetch quotes and execute the actions you request, the Interface sends your wallet
          address and order parameters (tokens, amounts, slippage, market identifiers) to the venue
          involved: the FX settlement provider, KyberSwap, CoW Protocol, LI.FI, Aave, Pendle, GMX, Hyperliquid, zkP2P /
          Peer, or Polymarket. Each venue processes that data under its own policy. We send only
          what is needed for the request you made.
        </P>

        <H2>3. Onchain data is public and permanent</H2>
        <P>
          Everything you do onchain (swaps, deposits, bets, P2P settlements) is written to public
          blockchains. It is visible to anyone, forever, and cannot be deleted by us or anyone else.
          Treat your onchain activity as public information.
        </P>

        <H2>4. localStorage and cookies</H2>
        <P>
          The Interface stores working state in your browser's localStorage: interface preferences,
          draft orders, P2P intent state, derived trading credentials for venues you use, and
          dismissed prompts. This data stays on your device and you can clear it through your
          browser at any time. Privy sets the storage it needs to keep you logged in. We do not set
          advertising or cross-site tracking cookies.
        </P>

        <H2>5. No trackers, no ads, no sale of data</H2>
        <P>
          The Interface runs no analytics or advertising scripts. The only third-party script it
          loads is Telegram's web app script, which is required for the Telegram mini app to
          function. We do not sell personal data, and we do not share it with anyone except the
          venues you transact with (section 2) and our hosting infrastructure (section 1). If this
          changes, this policy will change first.
        </P>

        <H2>6. Retention</H2>
        <P>
          Operational server logs are retained for 90 days and then deleted. Browser storage
          persists until you clear it. Onchain data is permanent by nature and outside anyone's
          control.
        </P>

        <H2>7. Your rights</H2>
        <P>
          Depending on where you live, you may have rights to access, correct, or delete personal
          data we hold, and to object to or restrict its processing. Because we hold very little
          (logs and, if you used Privy login, an email), requests are usually simple. Contact us at
          support@[YOUR_DOMAIN] and we will respond within the time your law requires. Note that we
          cannot alter or erase onchain data.
        </P>

        <H2>8. Changes to this policy</H2>
        <P>
          We may update this policy. When we do, we will change the "Last updated" date above and
          post the new version on this page. Material changes will be flagged on the site.
        </P>

        <P>
          See also the{" "}
          <a href="/legal/terms" className="underline underline-offset-2">
            terms of service
          </a>
          .
        </P>
      </main>
    </>
  );
}
