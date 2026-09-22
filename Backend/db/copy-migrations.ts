import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations"
);
const outputDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
  "db",
  "migrations"
);

const copyMigrations = async (): Promise<void> => {
  const files = (await readdir(sourceDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  await mkdir(outputDirectory, { recursive: true });

  await Promise.all(
    files.map(async (file) => {
      const content = await readFile(path.join(sourceDirectory, file));
      await writeFile(path.join(outputDirectory, file), content);
    })
  );
};

copyMigrations().catch((error: unknown) => {
  console.error("copy_postgres_migrations_failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
