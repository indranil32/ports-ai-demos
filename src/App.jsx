import React, { useEffect, useState } from 'react';
import { HardHat, Gavel, Radio, Anchor, ArrowLeft, ArrowRight } from 'lucide-react';
import QuaywatchHSE from './prototypes/QuaywatchHSE.jsx';
import AgenticLeaseAuditor from './prototypes/AgenticLeaseAuditor.jsx';
import ExecutiveDigitalTwin from './prototypes/ExecutiveDigitalTwin.jsx';
import CargoCopilot from './prototypes/CargoCopilot.jsx';

const DEMOS = [
  {
    slug: 'quaywatch',
    name: 'Quaywatch',
    tagline: 'HSE incident intelligence',
    blurb: 'Log an incident by text, voice or photo; AI classifies category, actual and potential severity, and contributing factors. Rule engine, TRIR/LTIFR, ISO 45001-aligned reporting, SENYAR CSV import.',
    icon: HardHat,
    accent: '#FFC72C',
    component: QuaywatchHSE,
  },
  {
    slug: 'lease-auditor',
    name: 'Agentic Lease Auditor',
    tagline: 'Multi-turn tool-calling with approval gates',
    blurb: 'Claude chooses which Maximo, lease-clause and throughput tools to call, reasons over the figures, and drafts dilapidation / royalty / default actions that wait for executive approval.',
    icon: Gavel,
    accent: '#22D3EE',
    component: AgenticLeaseAuditor,
  },
  {
    slug: 'digital-twin',
    name: 'Executive Digital Twin',
    tagline: 'AI Chief of Staff across 10 domains',
    blurb: 'Scored dashboard over PCS, marine, terminal, customs, finance, assets, HSE, customer, risk and weather. Daily Brief, newsletter, Ask the Chief of Staff, and a What-If simulator.',
    icon: Radio,
    accent: '#5EEAD4',
    component: ExecutiveDigitalTwin,
  },
  {
    slug: 'cargo-copilot',
    name: 'Cargo Copilot',
    tagline: 'Customer-facing exception management',
    blurb: 'Scans ATLP-shaped shipments at Khalifa Port for customs holds, missed appointments and vessel delays, computes demurrage deterministically, and routes proposals through human approval.',
    icon: Anchor,
    accent: '#F59E0B',
    component: CargoCopilot,
  },
];

function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

function Home() {
  return (
    <div style={{ minHeight: '100vh', background: '#0B1524', color: '#E8EDF4', fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        .demo-card { transition: border-color .15s ease, transform .15s ease; }
        .demo-card:hover { transform: translateY(-2px); border-color: #3A4F6E !important; }`}</style>
      <div style={{ height: 6, backgroundImage: 'repeating-linear-gradient(135deg, #0B1524 0 10px, #FFC72C 10px 20px)' }} />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '56px 24px 64px' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7C93AD', fontWeight: 600 }}>
          AD Ports Group · Digital &amp; Technology
        </div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 700, margin: '10px 0 12px', lineHeight: 1.1 }}>
          Agentic AI prototypes for port operations
        </h1>
        <p style={{ fontSize: 16, color: '#A9B8CA', maxWidth: 720, lineHeight: 1.6, margin: 0 }}>
          Four working prototypes, each calling the live Claude API. The model reasons and chooses what to look up;
          every financial figure is computed deterministically in code; every consequential action waits for a human.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginTop: 40 }}>
          {DEMOS.map((d) => {
            const Icon = d.icon;
            return (
              <a
                key={d.slug}
                href={`#/${d.slug}`}
                className="demo-card"
                style={{
                  display: 'block', textDecoration: 'none', color: 'inherit',
                  background: '#101B2D', border: '1px solid #1E2C44', borderRadius: 14, padding: 22,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${d.accent}1F` }}>
                    <Icon size={20} color={d.accent} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700 }}>{d.name}</div>
                    <div style={{ fontSize: 12.5, color: d.accent, fontWeight: 600 }}>{d.tagline}</div>
                  </div>
                </div>
                <p style={{ fontSize: 13.5, color: '#A9B8CA', lineHeight: 1.6, margin: '14px 0 16px' }}>{d.blurb}</p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#E8EDF4' }}>
                  Open demo <ArrowRight size={14} />
                </div>
              </a>
            );
          })}
        </div>

        <p style={{ fontSize: 12, color: '#5A6E88', marginTop: 40, lineHeight: 1.6 }}>
          Prototypes run on synthetic data shaped like SENYAR, IBM Maximo and ATLP exports. Figures, tariffs and
          entities are illustrative and do not represent AD Ports Group data.
        </p>
      </div>
    </div>
  );
}

function BackButton() {
  return (
    <a
      href="#/"
      title="All demos"
      style={{
        position: 'fixed', left: 14, bottom: 14, zIndex: 1000,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', borderRadius: 999, textDecoration: 'none',
        background: 'rgba(11,21,36,0.88)', color: '#E8EDF4', border: '1px solid #2A3B54',
        fontSize: 12.5, fontWeight: 600, fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)',
      }}
    >
      <ArrowLeft size={14} /> All demos
    </a>
  );
}

export default function App() {
  const route = useHashRoute();
  const demo = DEMOS.find((d) => d.slug === route);
  useEffect(() => {
    document.title = demo ? `${demo.name} — AD Ports AI` : 'AD Ports — Agentic AI Prototypes';
  }, [demo]);
  if (!demo) return <Home />;
  const Demo = demo.component;
  return (
    <>
      <Demo key={demo.slug} />
      <BackButton />
    </>
  );
}
