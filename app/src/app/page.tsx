import Image from "next/image";
import Link from "next/link";

const processSteps = [
  {
    id: "01",
    title: "Scan and monitor",
    description:
      "Continuously tracks your social presence and competitor activity across major channels.",
  },
  {
    id: "02",
    title: "Analyze and understand",
    description:
      "Builds a live picture of your market, audience behavior, and content performance.",
  },
  {
    id: "03",
    title: "Identify trends",
    description:
      "Spots emerging topics before they peak, so you publish while attention is building.",
  },
  {
    id: "04",
    title: "Suggest content",
    description:
      "Generates channel-ready copy, visual direction, and hashtag strategy in your voice.",
  },
  {
    id: "05",
    title: "Optimize channels",
    description:
      "Recommends the right platform mix and posting cadence for your goals.",
  },
  {
    id: "06",
    title: "Auto-post and learn",
    description:
      "Publishes at optimal times and improves recommendations from every result. Finds relevant corporate client leads and drafts introduction emails that actually convert.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "$39",
    subtitle: "Perfect for freelancers and solopreneurs",
    features: ["3 social accounts", "60 AI-generated posts/month", "Basic analytics", "Email support"],
  },
  {
    name: "Professional",
    price: "$89",
    subtitle: "Ideal for growing businesses and agencies",
    features: ["10 social accounts", "Unlimited AI posts", "Advanced analytics", "Competitor tracking"],
  },
  {
    name: "Growth",
    price: "$149",
    subtitle: "Built for scaling businesses",
    features: ["20 social accounts", "Unlimited AI posts", "Priority support", "Advanced intelligence suite"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "$299",
    subtitle: "For organizations with custom needs",
    features: ["Unlimited accounts", "Custom AI training", "Dedicated manager", "SLA and API access"],
  },
];

export default function Home() {
  return (
    <div className="landing-shell">
      <div className="landing-grid" />
      <div className="landing-glow" />
      <div className="landing-grain" />

      <nav className="landing-nav landing-container flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <Image src="/logo-wizard.jpg" alt="tevy2" width={36} height={36} className="h-9 w-9 rounded-lg" />
          <div className="landing-display text-lg font-bold tracking-tight">TevY2.ai</div>
          <span className="landing-badge">Powered by OpenClaw</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="landing-btn-outline !px-4 !py-2 text-sm">
            Log in
          </Link>
          <Link href="/setup" className="landing-btn-primary !px-4 !py-2 text-sm">
            Request demo
          </Link>
        </div>
      </nav>

      <main className="landing-container pb-24">
        <section className="landing-hero pb-20 pt-8 md:pt-12">
          <p className="landing-eyebrow mb-5">AI-powered - Fully automated - Data-driven</p>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
            <div className="landing-panel p-6 md:p-8">
              <h1 className="landing-headline mb-6">
                The social media wizard that turns <span className="landing-highlight">chaos</span> into{" "}
                <span className="landing-em">conversions</span>
              </h1>
              <p className="landing-muted mb-6 max-w-2xl text-base md:text-lg">
                TevY2 agent combines real time intelligence, augmented content creation and advanced automated lead genreation so businesses can grow faster without adding marketing overhead. TevY2 agent is the perfect social partner for the growing 15,000,000 person higgsfield.ai community.
              </p>
              <div className="grid gap-2 text-sm md:text-base">
                <p className="landing-list-item">Competitor intelligence that runs 24/7</p>
                <p className="landing-list-item">Trend detection before topics peak</p>
                <p className="landing-list-item">Brand-matched content generated at scale</p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/setup" className="landing-btn-primary">
                  Start free trial
                </Link>
                <a href="#how-it-works" className="landing-btn-outline">
                  Explore how it works
                </a>
              </div>
            </div>

            <div className="landing-panel overflow-hidden p-2">
              <Image
                src="/hero-portrait.jpg"
                alt="TevY2 Social Media Wizard"
                width={960}
                height={1280}
                priority
                className="h-full min-h-[320px] w-full rounded-2xl object-cover"
              />
            </div>
          </div>
        </section>

        <section className="landing-section py-10" id="problem">
          <p className="landing-eyebrow mb-4">The problem</p>
          <h2 className="landing-section-title mb-8">
            96% of SMBs use social media, but <span className="landing-highlight">90% fail to generate results</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="landing-card">
              <p className="landing-stat">96%</p>
              <p className="landing-card-title">Social adoption is universal</p>
              <p className="landing-muted text-sm">Businesses know social channels are essential for growth and visibility.</p>
            </div>
            <div className="landing-card">
              <p className="landing-stat">90%</p>
              <p className="landing-card-title">Results are inconsistent</p>
              <p className="landing-muted text-sm">Most businesses invest heavily yet fail to produce reliable business impact.</p>
            </div>
            <div className="landing-card">
              <p className="landing-stat">61%</p>
              <p className="landing-card-title">ROI is unclear</p>
              <p className="landing-muted text-sm">Without clear attribution, strategy and budget decisions stay reactive.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="landing-card">
              <p className="landing-card-title">Time-intensive</p>
              <p className="landing-muted text-sm">Creating content, reviewing metrics, and engaging audiences can exceed 15 hours per week per platform.</p>
            </div>
            <div className="landing-card">
              <p className="landing-card-title">Complexity overload</p>
              <p className="landing-muted text-sm">Teams juggle roughly 6.8 platforms with different algorithms, formats, and audience behavior.</p>
            </div>
            <div className="landing-card">
              <p className="landing-card-title">Constant change</p>
              <p className="landing-muted text-sm">Trends, best practices, and distribution systems shift daily, making manual adaptation too slow.</p>
            </div>
          </div>
        </section>

        <section className="landing-section py-10">
          <p className="landing-eyebrow mb-4">Pain points</p>
          <h2 className="landing-section-title mb-8">Three questions every marketer keeps asking</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="landing-card">
              <p className="landing-card-title">How do we influence our audience day to day?</p>
              <p className="landing-muted text-sm">Most businesses still post without reliable insight into timing, behavior, and message resonance.</p>
            </div>
            <div className="landing-card">
              <p className="landing-card-title">How do we stay relevant?</p>
              <p className="landing-muted text-sm">By the time trends are recognized manually, the opportunity window is usually closed.</p>
            </div>
            <div className="landing-card">
              <p className="landing-card-title">How do we scale high-quality content?</p>
              <p className="landing-muted text-sm">Manual production is slow and inconsistent, causing posting gaps and lost momentum.</p>
            </div>
          </div>
          <p className="mt-5 landing-muted">
            The gap: most tools help businesses schedule posts, but not decide what to post, when to post, and why it matters.
          </p>
        </section>

        <section className="landing-section py-10">
          <p className="landing-eyebrow mb-4">The solution</p>
          <div className="landing-panel p-6 md:p-8">
            <h2 className="landing-section-title mb-4">Meet TevY2: your AI social media wizard</h2>
            <blockquote className="landing-quote mb-6">
              &quot;TevY2 is like having data scientists, content strategists, and social media managers
              working 24/7 at a fraction of the cost.&quot;
            </blockquote>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="landing-card">
                <p className="landing-card-title">Intelligent analysis</p>
                <p className="landing-muted text-sm">Scans competitors, market trends, and audience behavior in real time.</p>
              </div>
              <div className="landing-card">
                <p className="landing-card-title">Automated creation</p>
                <p className="landing-muted text-sm">Builds platform-optimized content that reflects your brand voice.</p>
              </div>
              <div className="landing-card">
                <p className="landing-card-title">Perfect timing</p>
                <p className="landing-muted text-sm">Publishes at high-impact moments based on audience and algorithm patterns.</p>
              </div>
              <div className="landing-card">
                <p className="landing-card-title">Continuous learning</p>
                <p className="landing-muted text-sm">Improves output quality and targeting from every campaign outcome.</p>
              </div>
            </div>
            <p className="mt-5 landing-muted text-sm">
              Strategic intelligence - End-to-end automation - Multi-platform mastery - Measurable ROI
            </p>
          </div>
        </section>

        <section id="how-it-works" className="landing-section py-10">
          <p className="landing-eyebrow mb-4">Product features</p>
          <h2 className="landing-section-title mb-8">How TevY2 works: six steps</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {processSteps.map((step) => (
              <div key={step.id} className="landing-card">
                <p className="landing-step">{step.id}</p>
                <p className="landing-card-title mt-2">{step.title}</p>
                <p className="landing-muted mt-2 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section py-10">
          <p className="landing-eyebrow mb-4">AI capabilities</p>
          <h2 className="landing-section-title mb-8">Intelligence that understands your market</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="landing-card">
              <p className="landing-card-title">Competitor intelligence</p>
              <p className="landing-muted mt-2 text-sm">Real-time activity tracking plus AI-driven gap analysis across content strategy.</p>
              <div className="landing-metric-chip mt-4">
                <p className="landing-highlight text-xl font-bold">+340%</p>
                <p className="landing-muted text-xs">Engagement increase</p>
              </div>
            </div>
            <div className="landing-card">
              <p className="landing-card-title">Market trend detection</p>
              <p className="landing-muted mt-2 text-sm">Identifies rising topics before they become mainstream so businesses can lead.</p>
              <div className="landing-metric-chip mt-4">
                <p className="landing-highlight text-xl font-bold">3 weeks</p>
                <p className="landing-muted text-xs">Typical early signal window</p>
              </div>
            </div>
            <div className="landing-card">
              <p className="landing-card-title">Customer understanding</p>
              <p className="landing-muted mt-2 text-sm">Deep analysis of demographics, behavior patterns, and sentiment by channel.</p>
              <div className="landing-metric-chip mt-4">
                <p className="landing-highlight text-xl font-bold">-60%</p>
                <p className="landing-muted text-xs">Time spent on manual planning</p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section py-10">
          <p className="landing-eyebrow mb-4">Automation engine</p>
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="landing-card">
              <h3 className="landing-card-title text-xl">Content creation at scale</h3>
              <p className="landing-muted mt-3 text-sm">
                TevY2 generates platform-ready copy, visual direction, and posting plans, then schedules and publishes at
                the right time for each audience.
              </p>
              <blockquote className="landing-quote mt-6">
                &quot;What used to take our business a full week now happens automatically in minutes.&quot;
              </blockquote>
              <p className="landing-muted mt-3 text-xs">Early beta customer</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="landing-metric-chip p-5">
                <p className="landing-highlight text-2xl font-bold">+287%</p>
                <p className="landing-muted text-sm">Engagement rate</p>
              </div>
              <div className="landing-metric-chip p-5">
                <p className="landing-highlight text-2xl font-bold">10x</p>
                <p className="landing-muted text-sm">Content output</p>
              </div>
              <div className="landing-metric-chip p-5">
                <p className="landing-highlight text-2xl font-bold">25 hrs/week</p>
                <p className="landing-muted text-sm">Time saved</p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section py-10">
          <p className="landing-eyebrow mb-4">Pricing</p>
          <h2 className="landing-section-title mb-8">Pricing</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pricingPlans.map((plan) => (
              <div key={plan.name} className={`landing-card ${plan.featured ? "landing-card-featured" : ""}`}>
                <p className="landing-card-title">{plan.name}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <p className="landing-highlight text-3xl font-bold">{plan.price}</p>
                  <p className="landing-muted text-sm">/mo</p>
                </div>
                <p className="landing-muted mt-2 text-sm">{plan.subtitle}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="landing-list-item">
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="landing-muted mt-6 text-sm">
            Target customers: SMBs, agencies, ecommerce brands, and creators. Goal: $10M ARR by Year 3 with a
            product-led growth motion.
          </p>
        </section>

        <section className="landing-section py-14 text-center">
          <p className="landing-eyebrow mb-4">Roadmap and vision</p>
          <h2 className="landing-section-title mb-4">Build the future of social media operations</h2>
          <p className="landing-muted mx-auto mb-8 max-w-3xl">
            By 2030, TevY2 is designed to become the social media operating system that businesses use to manage,
            optimize, and monetize their full social presence.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/setup" className="landing-btn-primary">
              Join beta program
            </Link>
            <a href="mailto:partner@tevy2.ai" className="landing-btn-outline">
              Partner with us
            </a>
            <a href="mailto:invest@tevy2.ai" className="landing-btn-outline">
              Investor contact
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
