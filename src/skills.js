// Skill → proficiency and where it was used. Edit freely.
// level: 3 = strong, 2 = solid, 1 = familiar. Link brightness in the 3D follows the level.
// projects: indices into PROJECTS (same order as the project stars around the constellation).

export const PROJECTS = [
  { name: 'Stock prediction', target: '[data-shape="8"]' },
  { name: 'Image-to-biomass', target: '[data-shape="9"]' },
  { name: 'EduSage', target: '[data-shape="10"]' },
  { name: 'Wave Habitat', target: '[data-shape="11"]' },
  { name: 'Portfolio v1', target: '[data-shape="12"]' },
  { name: 'ZetaQ', target: '[data-shape="3"]' },
  { name: 'Thinking Engines', target: '[data-shape="4"]' },
  { name: 'Arms Robotics', target: '[data-shape="5"]' },
  { name: 'VanillaKart', target: '[data-shape="6"]' },
  { name: 'This site', target: '#top' },
]

const P = { STOCK: 0, BIOMASS: 1, EDUSAGE: 2, WAVE: 3, V1: 4, ZETAQ: 5, THINKING: 6, ARMS: 7, VANILLA: 8, SITE: 9 }

export const SKILLS = {
  // Languages
  Python: { level: 3, projects: [P.ZETAQ, P.STOCK, P.BIOMASS] },
  JavaScript: { level: 3, projects: [P.EDUSAGE, P.THINKING, P.ARMS, P.WAVE, P.VANILLA, P.V1, P.SITE] },
  SQL: { level: 2, projects: [] },
  HTML5: { level: 3, projects: [P.THINKING, P.ARMS, P.VANILLA, P.EDUSAGE, P.V1, P.SITE] },
  CSS3: { level: 3, projects: [P.THINKING, P.ARMS, P.VANILLA, P.EDUSAGE, P.V1, P.SITE] },
  // Frontend
  'React.js': { level: 3, projects: [P.EDUSAGE, P.THINKING, P.V1] },
  'Responsive Design': { level: 3, projects: [P.THINKING, P.ARMS, P.EDUSAGE, P.SITE] },
  'UI/UX': { level: 2, projects: [P.THINKING, P.EDUSAGE, P.V1, P.SITE] },
  // Backend
  'Node.js': { level: 3, projects: [P.EDUSAGE, P.THINKING, P.WAVE, P.VANILLA] },
  'Express.js': { level: 2, projects: [P.EDUSAGE, P.THINKING] },
  'REST APIs': { level: 2, projects: [P.EDUSAGE, P.THINKING, P.WAVE] },
  // Databases
  MongoDB: { level: 2, projects: [P.EDUSAGE] },
  MySQL: { level: 1, projects: [] },
  NoSQL: { level: 2, projects: [P.EDUSAGE] },
  // AI / ML
  'Prompt engineering': { level: 3, projects: [P.ZETAQ, P.EDUSAGE] },
  'LLM integration (Gemini API)': { level: 3, projects: [P.ZETAQ, P.EDUSAGE, P.V1] },
  'Data collection & cleaning': { level: 2, projects: [P.ZETAQ, P.STOCK, P.BIOMASS] },
  'Multimodal modelling': { level: 2, projects: [P.STOCK, P.BIOMASS] },
  'CNNs / Deep learning': { level: 1, projects: [P.BIOMASS] },
  pandas: { level: 2, projects: [P.STOCK, P.BIOMASS] },
  NumPy: { level: 2, projects: [P.STOCK, P.BIOMASS] },
  'scikit-learn': { level: 1, projects: [P.STOCK, P.BIOMASS] },
  // Tools & cloud
  'Git / GitHub': { level: 3, projects: [P.EDUSAGE, P.THINKING, P.ARMS, P.V1, P.SITE] },
  'Cloudflare Workers': { level: 1, projects: [P.V1] },
  Vercel: { level: 2, projects: [P.V1, P.SITE] },
  Railway: { level: 1, projects: [] },
  Render: { level: 1, projects: [] },
  // Concepts
  'Full-stack development': { level: 3, projects: [P.EDUSAGE, P.THINKING, P.WAVE, P.V1] },
  'API integration': { level: 2, projects: [P.ZETAQ, P.EDUSAGE, P.WAVE] },
  'Data preprocessing': { level: 2, projects: [P.ZETAQ, P.STOCK, P.BIOMASS] },
  'Cryptography fundamentals': { level: 1, projects: [] },
  SEO: { level: 2, projects: [P.VANILLA] },
}

export const LEVELS = { 3: 'Strong', 2: 'Solid', 1: 'Familiar' }
