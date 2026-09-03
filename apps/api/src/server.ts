import { buildApp } from './app.js';
import { getConfig } from './config.js';
import { disconnectPrisma, getPrisma } from './prisma.js';
import { createServices } from './services/index.js';

async function main(): Promise<void> {
  const config = getConfig();
  const services = createServices(config, getPrisma());
  const app = await buildApp(services);

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'stänger ner');
    await app.close();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
