FROM node:22-bookworm-slim

WORKDIR /app
RUN npm install --global pnpm@10.28.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/react/package.json packages/react/package.json
RUN pnpm --filter dashboard... install --frozen-lockfile

COPY apps/dashboard/src apps/dashboard/src
COPY apps/dashboard/scripts/worker.ts apps/dashboard/scripts/worker.ts
COPY apps/dashboard/tsconfig.json apps/dashboard/drizzle.config.ts apps/dashboard/
COPY packages/core/src packages/core/src

ENV NODE_ENV=production
USER node
WORKDIR /app/apps/dashboard
CMD ["node", "--import", "tsx", "scripts/worker.ts"]
