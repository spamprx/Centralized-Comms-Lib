import swaggerJSDoc from "swagger-jsdoc";
import path from "path";

const REMOTE_URL = process.env.REMOTE_URL;
if (!REMOTE_URL) {
  throw new Error("REMOTE_URL is not set");
}

const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "Centralized Comms API",
    version: "1.0.0",
    description:
      "HTTP API for the Centralized Comms Library. This documentation is generated from JSDoc annotations in the Express route files.",
  },
  servers: [
    {
      url: "http://localhost:8000",
      description: "Local development",
    },
    {
      url: REMOTE_URL,
      description: "Remote development",
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  tags: [
    { name: "Content", description: "Drafts, versions, lifecycle, tags" },
    { name: "Templates", description: "Layouts, bindings, i18n, formatting rules" },
    { name: "Search", description: "Full-text and similarity search" },
    { name: "Components", description: "Reusable components and template sections" },
    { name: "Citations", description: "Citation string rendering" },
    { name: "Analytics", description: "Metrics and dashboards" },
  ],
};

// Support both TypeScript (dev with ts-node) and compiled JavaScript (prod build).
// __dirname will be:
//   - src/docs           when running with ts-node
//   - dist/docs          when running compiled JS
const routesGlobTs = path.resolve(__dirname, "../modules/*/*.routes.ts");
const routesGlobJs = path.resolve(__dirname, "../modules/*/*.routes.js");
const appGlobTs = path.resolve(__dirname, "../app.ts");
const appGlobJs = path.resolve(__dirname, "../app.js");

const options: swaggerJSDoc.Options = {
  swaggerDefinition,
  apis: [routesGlobTs, routesGlobJs, appGlobTs, appGlobJs],
};

export const openapiSpec = swaggerJSDoc(options);

if (require.main === module) {
  // Optional: generate a static JSON file when run directly.
  //   npx ts-node src/docs/openapi.ts > openapi.json
  // This avoids wiring a separate build script and lets you
  // capture the current spec on disk when needed.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(openapiSpec, null, 2));
}

