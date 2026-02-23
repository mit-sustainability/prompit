import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "pb_data/**",
      "bin/pb_data/**",
      "infra/pocketbase/pb_data/**",
      "pb_migrations/**"
    ]
  }
];

export default eslintConfig;
