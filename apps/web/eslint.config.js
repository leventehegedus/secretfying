import reactHooks from "eslint-plugin-react-hooks";
import root from "../../eslint.config.js";

export default [
  ...root,
  reactHooks.configs.flat["recommended-latest"] ?? reactHooks.configs.flat.recommended,
];
