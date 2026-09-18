// drizzle-kit's `.sql` migrations are inlined as strings by babel-plugin-inline-import (§4.6).
declare module '*.sql' {
  const sql: string;
  export default sql;
}
