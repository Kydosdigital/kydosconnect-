import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function Home() {
  return (
    <>
      <header className="shell topbar">
        <Wordmark />
        <Link className="btn btn-quiet" href="/login">
          Sign in
        </Link>
      </header>

      <main className="shell">
        <section className="hero">
          <div>
            <h1>Your website, working inside every AI assistant.</h1>
            <p className="lede">
              Kydos Connect lets Claude, ChatGPT and other assistants read your website, check your hours and prices, and answer
              with the right details. Set up by Kydos Digital, no technical work for you.
            </p>
            <div className="row" style={{ marginTop: 32 }}>
              <Link className="btn btn-primary" href="/login">
                Connect your website
              </Link>
              <a className="btn btn-quiet" href="mailto:kydosdigital@gmail.com?subject=Kydos%20Connect">
                Talk to Kydos Digital
              </a>
            </div>
          </div>

          <figure className="chat" aria-label="Example: an assistant answering from a connected website" style={{ margin: 0 }}>
            <p className="chat-q">Can I get a sports massage this Saturday morning, and how much is an hour?</p>
            <div className="chat-a">
              <span className="chat-tool status status-live">Checked Physio Matters&rsquo; website</span>
              <p>
                Yes. They are open on Saturdays from 9am to 1pm, and a 60-minute sports massage costs £55. You can book online
                or call 0161 000 0000.
              </p>
              <span className="chat-source">Source: physiomatters.co.uk/sports-massage</span>
            </div>
          </figure>
        </section>

        <section className="tiers" aria-label="Plans">
          <div className="tier">
            <h2>Read it</h2>
            <p className="muted">Assistants can read your pages, services, prices and opening hours.</p>
            <ul>
              <li>Your whole website, kept up to date</li>
              <li>Answers quote the page they came from</li>
              <li>Works with Claude, ChatGPT and Cursor</li>
            </ul>
          </div>
          <div className="tier">
            <h2>Measure it</h2>
            <p className="muted">Ask how your website is doing instead of opening Google Analytics.</p>
            <ul>
              <li>Traffic, top pages and visitors right now</li>
              <li>Enquiries from your contact forms</li>
              <li>A plain-English monthly report</li>
            </ul>
          </div>
          <div className="tier">
            <h2>Manage it</h2>
            <p className="muted">Update your website by asking. Every change waits for your approval.</p>
            <ul>
              <li>Edit text, prices, hours and banners</li>
              <li>Draft blog posts for you to review</li>
              <li>Alerts when something breaks</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="shell" style={{ paddingBlock: 32, borderTop: "1px solid var(--line)" }}>
        <p className="small faint">Kydos Connect by Kydos Digital Ltd, Oldham.</p>
      </footer>
    </>
  );
}
