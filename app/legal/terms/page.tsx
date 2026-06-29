import { Nav } from "@/components/shared/Nav";

export const metadata = {
  title: "Terms of service",
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

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12 text-[var(--color-fg-1)]">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-2)]">
          Legal · Terms of service
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-[var(--color-fg-0)]">
          Terms of service
        </h1>
        <p className="mt-2 font-mono text-xs text-[var(--color-fg-2)]">Last updated: 2026-06-12</p>

        <P>
          These terms govern your use of [APP_NAME], the website at [YOUR_DOMAIN] and its related
          interfaces, including the Telegram mini app (together, the "Interface"). By using the
          Interface you agree to these terms. If you do not agree, do not use the Interface.
        </P>

        <H2>1. What [APP_NAME] is, and what it is not</H2>
        <P>
          [APP_NAME] is software. It is a self-custodial interface that helps you view data from, and
          construct transactions for, public blockchain protocols and third-party trading venues.
          [APP_NAME] does not hold your funds, does not hold your private keys, and cannot move assets
          on your behalf. Every transaction requires your cryptographic signature, produced by a
          wallet that you control.
        </P>
        <P>
          [APP_NAME] is not a counterparty to any trade, not a broker, not an exchange, not a money
          transmitter, not a payment processor, and not a deposit-taking institution. When you swap,
          lend, bridge, ramp, or place a prediction-market order through the Interface, you are
          transacting directly with third-party protocols and their other users, not with us.
        </P>

        <H2>2. Eligibility</H2>
        <P>
          You must be at least 18 years old, or older if the laws that apply to you set a higher
          minimum age for the activity in question (prediction markets in particular often require a
          higher minimum age). You must have the legal capacity to enter into these terms, and your
          use of the Interface must be lawful where you are.
        </P>

        <H2>3. Prohibited jurisdictions and sanctions</H2>
        <P>
          You may not use the Interface if you are located in, organized in, a resident of, or a
          citizen of any jurisdiction subject to comprehensive sanctions administered by the U.S.
          Office of Foreign Assets Control (OFAC) or equivalent authorities, or if you are listed on
          any sanctions list, or if you are acting on behalf of any such person. By using the
          Interface you represent that none of these apply to you.
        </P>
        <P>
          You may not use a VPN or any other technique to disguise your location in order to access
          the Interface or any underlying venue from a place where it is restricted.
        </P>

        <H2>4. Self-custody and irreversible transactions</H2>
        <P>
          You are solely responsible for your wallet, your keys, and everything you sign. Blockchain
          transactions are final. Once a transaction you signed is confirmed onchain, neither [APP_NAME]
          nor anyone else can reverse it, recover assets sent to a wrong address, or undo a trade
          executed at a price you did not intend. There is no recourse mechanism inside the
          Interface or the underlying protocols. Review every transaction before you sign it.
        </P>

        <H2>5. Third-party protocols and venues</H2>
        <P>
          The Interface routes to and displays data from third-party protocols and venues that we do
          not control, including: the FX settlement provider, KyberSwap, CoW Protocol, and
          LI.FI (swap routing and bridging), Aave, Pendle, GMX, and Hyperliquid (yield and trading),
          zkP2P / Peer (peer-to-peer fiat on and off ramp), Polymarket (prediction markets), and
          Privy (wallet authentication). Each of these has its own terms, its own risks, and its own
          jurisdiction restrictions, and your use of them through the Interface is governed by their
          terms in addition to these. We make no promises about their availability, security,
          pricing, or behavior, and we may add, remove, or disable any integration at any time.
        </P>

        <H2>6. Prediction markets (Polymarket)</H2>
        <P>
          The World Cup prediction features on the Interface route to Polymarket, a third-party
          prediction market. Access to Polymarket is restricted in a number of jurisdictions,
          including for US persons and for residents of various other countries. These restrictions
          apply to citizenship and residency, not just to physical location. You are solely
          responsible for determining whether you are eligible to use prediction markets, and you
          must not use the Interface to circumvent any restriction that applies to you.
        </P>
        <P>
          Betting features may be unavailable, gated, or disabled at any time, in whole or for your
          jurisdiction, without notice. Prediction market positions can lose their entire value.
          Prices shown are market odds, not guarantees of any outcome.
        </P>

        <H2>7. Peer-to-peer cash ramp (zkP2P / Peer)</H2>
        <P>
          The cash on and off ramp matches you directly with other users who buy or sell crypto
          against fiat payment platforms, with settlement secured by cryptographic proofs. [APP_NAME] is
          not a party to these trades. Your counterparty is another user, your fiat leg runs over a
          third-party payment platform under that platform's own terms, and disputes with payment
          platforms or counterparties are between you and them. P2P trades carry counterparty,
          payment-reversal, and platform-policy risk that onchain swaps do not.
        </P>

        <H2>8. No advice</H2>
        <P>
          Nothing on the Interface is investment, financial, legal, or tax advice. Quotes, exchange
          rates, yields, APYs, scores, rankings, and probabilities are informational displays of
          third-party or market data. They can be wrong, stale, or change before you transact. You
          make your own decisions and bear their results.
        </P>

        <H2>9. Simulated data and preview features</H2>
        <P>
          Some surfaces on the Interface display simulated or seeded data and are labeled "Simulated
          preview" (for example, certain order book and recent trade panels) or show sample figures
          when no wallet is connected. Simulated data does not reflect real markets or real
          balances. Some features are offered as waitlists or previews and may never launch, or may
          launch in a different form.
        </P>

        <H2>10. Fees, gas, and taxes</H2>
        <P>
          The underlying venues charge their own fees, and every onchain transaction costs network
          gas. Both come out of your assets, and both are your responsibility. So are your taxes:
          you are solely responsible for determining and paying any taxes that arise from your
          activity through the Interface.
        </P>

        <H2>11. Risks</H2>
        <P>
          Using onchain financial products involves serious risk, including: total loss of funds,
          smart contract bugs and exploits, oracle failures, depegs of stablecoins, bridge failures,
          liquidity gaps, extreme volatility, front-running, failed or stuck transactions, and
          regulatory action against the protocols you use. By using the Interface you accept these
          risks. Do not commit funds you cannot afford to lose.
        </P>

        <H2>12. As-is, no warranty</H2>
        <P>
          The Interface is provided "as is" and "as available", without warranty of any kind,
          express or implied, including merchantability, fitness for a particular purpose, accuracy,
          and non-infringement. We do not warrant that the Interface will be uninterrupted, secure,
          or error free, or that displayed data is correct.
        </P>

        <H2>13. Limitation of liability</H2>
        <P>
          To the maximum extent permitted by law, [APP_NAME] and its contributors will not be liable for
          any indirect, incidental, special, consequential, or exemplary damages, or for any loss of
          funds, profits, data, or goodwill, arising from your use of the Interface or any
          underlying protocol, even if advised of the possibility. To the extent any liability is
          found despite the above, it is capped at one hundred US dollars (USD 100) in aggregate.
        </P>

        <H2>14. Indemnification</H2>
        <P>
          You will indemnify and hold harmless [APP_NAME] and its contributors from claims, damages, and
          expenses (including reasonable legal fees) arising from your use of the Interface, your
          violation of these terms, or your violation of any law or third-party right.
        </P>

        <H2>15. Changes to these terms</H2>
        <P>
          We may update these terms. When we do, we will change the "Last updated" date above and
          post the new version on this page. Material changes will be flagged on the site.
          Continuing to use the Interface after a change means you accept the updated terms.
        </P>

        <H2>16. Governing law</H2>
        <P>
          These terms are governed by the laws of the British Virgin Islands, without regard to
          conflict of law rules.
        </P>

        <H2>17. Contact</H2>
        <P>
          Questions about these terms: support@[YOUR_DOMAIN]. See also the{" "}
          <a href="/legal/privacy" className="underline underline-offset-2">
            privacy policy
          </a>
          .
        </P>
      </main>
    </>
  );
}
