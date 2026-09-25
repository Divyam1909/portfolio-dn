// Skill → proficiency and where it was used. Edit freely.
// level: 3 = strong, 2 = solid, 1 = familiar. Link brightness in the 3D follows the level.
// projects: indices into PROJECTS (same order as the project stars around the constellation).

export const PROJECTS = [
  { name: 'Stock prediction', target: '[data-shape="6"]' },
  { name: 'Image-to-biomass', target: '[data-shape="7"]' },
  { name: 'EduSage', target: '[data-shape="8"]' },
  { name: 'Portfolio v1', target: '[data-shape="9"]' },
  { name: 'ZetaQ', target: '[data-shape="3"]' },
  { name: 'Thinking Engines', target: '[data-shape="4"]' },
  { name: 'Arms Robotics', target: '[data-shape="5"]' },
  { name: 'This site', target: '#top' },
]

const P = { STOCK: 0, BIOMASS: 1, EDUSAGE: 2, V1: 3, ZETAQ: 4, THINKING: 5, ARMS: 6, SITE: 7 }

export const SKILLS = {
  Python: { level: 3, projects: [P.ZETAQ, P.STOCK, P.BIOMASS] },
  JavaScript: { level: 3, projects: [P.EDUSAGE, P.THINKING, P.ARMS, P.V1, P.SITE] },
  SQL: { level: 2, projects: [] },
  HTML5: { level: 3, projects: [P.THINKING, P.ARMS, P.EDUSAGE, P.V1, P.SITE] },
  CSS3: { level: 3, projects: [P.THINKING, P.ARMS, P.EDUSAGE, P.V1, P.SITE] },
  'React.js': { level: 3, projects: [P.EDUSAGE, P.THINKING, P.V1] },
  'Node.js': { level: 3, projects: [P.EDUSAGE, P.THINKING] },
  'Express.js': { level: 2, projects: [P.EDUSAGE, P.THINKING] },
  'REST APIs': { level: 2, projects: [P.EDUSAGE, P.THINKING, P.ARMS] },
  'Responsive UI/UX': { level: 3, projects: [P.THINKING, P.ARMS, P.EDUSAGE, P.SITE] },
  'Prompt engineering': { level: 3, projects: [P.ZETAQ, P.EDUSAGE] },
  'LLM integration (Gemini API)': { level: 3, projects: [P.ZETAQ, P.EDUSAGE, P.V1] },
  'Data collection & cleaning': { level: 2, projects: [P.ZETAQ, P.STOCK, P.BIOMASS] },
  'Multimodal modelling': { level: 2, projects: [P.STOCK, P.BIOMASS] },
  'CNNs / Deep learning': { level: 1, projects: [P.BIOMASS] },
  pandas: { level: 2, projects: [P.STOCK, P.BIOMASS] },
  NumPy: { level: 2, projects: [P.STOCK, P.BIOMASS] },
  'scikit-learn': { level: 1, projects: [P.STOCK, P.BIOMASS] },
  MongoDB: { level: 2, projects: [P.EDUSAGE] },
  MySQL: { level: 1, projects: [] },
  'Git / GitHub': { level: 3, projects: [P.EDUSAGE, P.THINKING, P.ARMS, P.V1, P.SITE] },
  'Cloudflare Workers': { level: 1, projects: [P.V1] },
  Vercel: { level: 2, projects: [P.V1] },
  Railway: { level: 1, projects: [] },
  Render: { level: 1, projects: [] },
}

export const LEVELS = { 3: 'Strong', 2: 'Solid', 1: 'Familiar' }
