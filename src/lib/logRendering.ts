type Rendering = 'SSR' | 'CSR' | 'SSG';

export function logRendering(flags: { prerender?: boolean | 'auto'; ssr?: boolean; csr?: boolean }) {
  const prerender = flags.prerender ?? false;
  const ssr = flags.ssr ?? true;

  const rendering: Rendering =
    prerender === true ? 'SSG' :
    ssr === false ? 'CSR' :
    'SSR';

  console.log(`Type de render : ${rendering}`);
}
