// Skill → proficiency and where it was used. Edit freely.
// level: 3 = strong, 2 = solid, 1 = familiar. Link brightness in the 3D follows the level.
// projects: indices into PROJECTS (same order as the project stars around the constellation).

export const PROJECTS = [
  { name: 'Stock prediction', target: '[data-shape="10"]' },
  { name: 'Image-to-biomass', target: '[data-shape="11"]' },
  { name: 'EduSage', target: '[data-shape="12"]' },
  { name: 'Wave Habitat', target: '[data-shape="13"]' },
  { name: 'Portfolio v1', target: '[data-shape="14"]' },
  { name: 'ZetaQ', target: '[data-shape="3"]' },
  { name: 'Thinking Engines', target: '[data-shape="4"]' },
  { name: 'Arms Robotics', target: '[data-shape="5"]' },
  { name: 'VanillaKart', target: '[data-shape="6"]' },
  { name: 'This site', target: '#top' },
  { name: 'LLM Observatory', target: '[data-shape="8"]' },
  { name: 'BiasLens', target: '[data-shape="9"]' },
]

const P = { STOCK: 0, BIOMASS: 1, EDUSAGE: 2, WAVE: 3, V1: 4, ZETAQ: 5, THINKING: 6, ARMS: 7, VANILLA: 8, SITE: 9, OBS: 10, BIAS: 11 }

export const SKILLS = {
  // Languages
  Python: { level: 3, projects: [P.OBS, P.BIAS, P.ZETAQ, P.STOCK, P.BIOMASS] },
  JavaScript: { level: 3, projects: [P.EDUSAGE, P.THINKING, P.ARMS, P.WAVE, P.VANILLA, P.V1, P.SITE] },
  TypeScript: { level: 2, projects: [] },
  C: { level: 2, projects: [] },
  SQL: { level: 2, projects: [P.OBS] },
  HTML5: { level: 3, projects: [P.THINKING, P.ARMS, P.VANILLA, P.EDUSAGE, P.V1, P.SITE] },
  CSS3: { level: 3, projects: [P.THINKING, P.ARMS, P.VANILLA, P.EDUSAGE, P.V1, P.SITE] },
  // Frontend
  'React.js': { level: 3, projects: [P.OBS, P.EDUSAGE, P.THINKING, P.V1] },
  'Next.js': { level: 2, projects: [] },
  Vite: { level: 2, projects: [P.SITE] },
  'Three.js': { level: 2, projects: [P.SITE, P.V1] },
  Recharts: { level: 2, projects: [P.OBS] },
  'Responsive Design': { level: 3, projects: [P.THINKING, P.ARMS, P.EDUSAGE, P.SITE] },
  'UI/UX': { level: 2, projects: [P.THINKING, P.EDUSAGE, P.V1, P.SITE] },
  // Backend
  'Node.js': { level: 3, projects: [P.EDUSAGE, P.THINKING, P.WAVE, P.VANILLA] },
  'Express.js': { level: 2, projects: [P.EDUSAGE, P.THINKING] },
  FastAPI: { level: 2, projects: [P.OBS] },
  'REST APIs': { level: 2, projects: [P.OBS, P.EDUSAGE, P.THINKING, P.WAVE] },
  WebSockets: { level: 2, projects: [] },
  // Databases
  'PostgreSQL (Supabase)': { level: 2, projects: [P.OBS] },
  MongoDB: { level: 2, projects: [P.EDUSAGE] },
  MySQL: { level: 1, projects: [] },
  NoSQL: { level: 2, projects: [P.EDUSAGE] },
  'ChromaDB (vector store)': { level: 1, projects: [] },
  // AI / ML
  PyTorch: { level: 2, projects: [P.BIAS, P.OBS] },
  'Hugging Face Transformers': { level: 2, projects: [P.BIAS, P.OBS] },
  'Prompt engineering': { level: 3, projects: [P.ZETAQ, P.EDUSAGE] },
  'LLM integration (Gemini API)': { level: 3, projects: [P.ZETAQ, P.EDUSAGE, P.V1] },
  RAG: { level: 2, projects: [] },
  'LoRA / QLoRA fine-tuning': { level: 2, projects: [P.OBS] },
  'Local LLM serving (Ollama, llama.cpp)': { level: 2, projects: [] },
  'Sparse autoencoders / Interpretability': { level: 2, projects: [P.BIAS] },
  'Data collection & cleaning': { level: 2, projects: [P.ZETAQ, P.STOCK, P.BIOMASS] },
  'Multimodal modelling': { level: 2, projects: [P.STOCK, P.BIOMASS] },
  'CNNs / Deep learning': { level: 1, projects: [P.BIOMASS] },
  pandas: { level: 2, projects: [P.STOCK, P.BIOMASS] },
  NumPy: { level: 2, projects: [P.STOCK, P.BIOMASS, P.BIAS] },
  'scikit-learn': { level: 1, projects: [P.STOCK, P.BIOMASS] },
  // Observability
  'OpenTelemetry (OTLP)': { level: 2, projects: [P.OBS] },
  'Distributed tracing & metrics': { level: 2, projects: [P.OBS] },
  'SDK auto-instrumentation': { level: 2, projects: [P.OBS] },
  'Anomaly & incident detection': { level: 2, projects: [P.OBS] },
  // Tools & cloud
  Linux: { level: 2, projects: [] },
  'Git / GitHub': { level: 3, projects: [P.OBS, P.EDUSAGE, P.THINKING, P.ARMS, P.V1, P.SITE] },
  Docker: { level: 2, projects: [] },
  'AWS (EC2 GPU)': { level: 1, projects: [] },
  'Google Colab': { level: 2, projects: [] },
  'Cloudflare Workers': { level: 1, projects: [P.V1] },
  Vercel: { level: 2, projects: [P.V1, P.SITE] },
  Railway: { level: 1, projects: [] },
  Render: { level: 1, projects: [] },
  // Concepts
  'Full-stack development': { level: 3, projects: [P.OBS, P.EDUSAGE, P.THINKING, P.WAVE, P.V1] },
  'API integration': { level: 2, projects: [P.ZETAQ, P.EDUSAGE, P.WAVE] },
  'Data preprocessing': { level: 2, projects: [P.ZETAQ, P.STOCK, P.BIOMASS] },
  'Walk-forward validation': { level: 2, projects: [P.STOCK] },
  'Cryptography fundamentals': { level: 1, projects: [] },
  SEO: { level: 2, projects: [P.VANILLA] },
}

export const LEVELS = { 3: 'Strong', 2: 'Solid', 1: 'Familiar' }
