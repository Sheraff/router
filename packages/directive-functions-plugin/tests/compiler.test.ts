import { describe, expect, test } from 'vitest'

import { compileDirectives } from '../src/compilers'
import type { CompileDirectivesOpts } from '../src/compilers'

const clientConfig: Omit<CompileDirectivesOpts, 'code'> = {
  directive: 'use server',
  directiveLabel: 'Server function',
  root: './test-files',
  filename: 'test.ts',
  getRuntimeCode: () => 'import { createClientRpc } from "my-rpc-lib-client"',
  replacer: (opts) => `createClientRpc(${JSON.stringify(opts.functionId)})`,
}

const ssrConfig: Omit<CompileDirectivesOpts, 'code'> = {
  directive: 'use server',
  directiveLabel: 'Server function',
  root: './test-files',
  filename: 'test.ts',
  getRuntimeCode: () => 'import { createSsrRpc } from "my-rpc-lib-server"',
  replacer: (opts) => `createSsrRpc(${JSON.stringify(opts.functionId)})`,
}

const serverConfig: Omit<CompileDirectivesOpts, 'code'> = {
  directive: 'use server',
  directiveLabel: 'Server function',
  root: './test-files',
  filename: 'test.ts',
  getRuntimeCode: () => 'import { createServerRpc } from "my-rpc-lib-server"',
  replacer: (opts) =>
    // On the server build, we need different code for the split function
    // vs any other server functions the split function may reference

    // For the split function itself, we use the original function.
    // For any other server functions the split function may reference,
    // we use the splitImportFn which is a dynamic import of the split file.
    `createServerRpc(${JSON.stringify(opts.functionId)}, ${opts.fn})`,
}

describe('server function compilation', () => {
  const code = `
      export const namedFunction = createServerFn(function namedFunction() {
        'use server'
        return 'hello'
      })

      export const arrowFunction = createServerFn(() => {
        'use server'
        return 'hello'
      })

      export const anonymousFunction = createServerFn(function () {
        'use server'
        return 'hello'
      })

      export const multipleDirectives = function multipleDirectives() {
        'use server'
        'use strict'
        return 'hello'
      }

      export const iife = (function () {
        'use server'
        return 'hello'
      })()

      export default function defaultExportFn() {
        'use server'
        return 'hello'
      }

      export function namedExportFn() {
        'use server'
        return 'hello'
      }

      export const exportedArrowFunction = wrapper(() => {
        'use server'
        return 'hello'
      })

      export const namedExportConst = () => {
        'use server'
        return usedFn()
      }

      function usedFn() {
        return 'hello'
      }

      function unusedFn() {
        return 'hello'
      }

      const namedDefaultExport = 'namedDefaultExport'
      export default namedDefaultExport

      const usedButNotExported = 'usedButNotExported'
      
      const namedExport = 'namedExport'

      export {
        namedExport
      }

    `

  test('basic function declaration nested in other variable', () => {
    const client = compileDirectives({
      ...clientConfig,
      code,
    })
    const ssr = compileDirectives({ ...ssrConfig, code })

    const server = compileDirectives({
      ...serverConfig,
      code,
      filename: `${ssr.directiveFnsById[Object.keys(ssr.directiveFnsById)[0]!]!.extractedFilename}`,
    })

    expect(client.compiledResult.code).toMatchInlineSnapshot(`
      "import { createClientRpc } from "my-rpc-lib-client";
      const namedFunction_createServerFn_namedFunction = createClientRpc("test_ts--namedFunction_createServerFn_namedFunction");
      export const namedFunction = createServerFn(namedFunction_createServerFn_namedFunction);
      const arrowFunction_createServerFn = createClientRpc("test_ts--arrowFunction_createServerFn");
      export const arrowFunction = createServerFn(arrowFunction_createServerFn);
      const anonymousFunction_createServerFn = createClientRpc("test_ts--anonymousFunction_createServerFn");
      export const anonymousFunction = createServerFn(anonymousFunction_createServerFn);
      const multipleDirectives_multipleDirectives = createClientRpc("test_ts--multipleDirectives_multipleDirectives");
      export const multipleDirectives = multipleDirectives_multipleDirectives;
      const iife_1 = createClientRpc("test_ts--iife_1");
      export const iife = iife_1();
      const defaultExportFn_1 = createClientRpc("test_ts--defaultExportFn_1");
      export default defaultExportFn_1;
      const namedExportFn_1 = createClientRpc("test_ts--namedExportFn_1");
      export const namedExportFn = namedExportFn_1;
      const exportedArrowFunction_wrapper = createClientRpc("test_ts--exportedArrowFunction_wrapper");
      export const exportedArrowFunction = wrapper(exportedArrowFunction_wrapper);
      const namedExportConst_1 = createClientRpc("test_ts--namedExportConst_1");
      export const namedExportConst = namedExportConst_1;
      const namedDefaultExport = 'namedDefaultExport';
      export default namedDefaultExport;
      const namedExport = 'namedExport';
      export { namedExport };"
    `)

    expect(ssr.compiledResult.code).toMatchInlineSnapshot(`
      "import { createSsrRpc } from "my-rpc-lib-server";
      const namedFunction_createServerFn_namedFunction = createSsrRpc("test_ts--namedFunction_createServerFn_namedFunction");
      export const namedFunction = createServerFn(namedFunction_createServerFn_namedFunction);
      const arrowFunction_createServerFn = createSsrRpc("test_ts--arrowFunction_createServerFn");
      export const arrowFunction = createServerFn(arrowFunction_createServerFn);
      const anonymousFunction_createServerFn = createSsrRpc("test_ts--anonymousFunction_createServerFn");
      export const anonymousFunction = createServerFn(anonymousFunction_createServerFn);
      const multipleDirectives_multipleDirectives = createSsrRpc("test_ts--multipleDirectives_multipleDirectives");
      export const multipleDirectives = multipleDirectives_multipleDirectives;
      const iife_1 = createSsrRpc("test_ts--iife_1");
      export const iife = iife_1();
      const defaultExportFn_1 = createSsrRpc("test_ts--defaultExportFn_1");
      export default defaultExportFn_1;
      const namedExportFn_1 = createSsrRpc("test_ts--namedExportFn_1");
      export const namedExportFn = namedExportFn_1;
      const exportedArrowFunction_wrapper = createSsrRpc("test_ts--exportedArrowFunction_wrapper");
      export const exportedArrowFunction = wrapper(exportedArrowFunction_wrapper);
      const namedExportConst_1 = createSsrRpc("test_ts--namedExportConst_1");
      export const namedExportConst = namedExportConst_1;
      const namedDefaultExport = 'namedDefaultExport';
      export default namedDefaultExport;
      const namedExport = 'namedExport';
      export { namedExport };"
    `)

    expect(server.compiledResult.code).toMatchInlineSnapshot(
      `
      "import { createServerRpc } from "my-rpc-lib-server";
      const namedFunction_createServerFn_namedFunction = createServerRpc("test_ts--namedFunction_createServerFn_namedFunction", function namedFunction() {
        return 'hello';
      });
      const arrowFunction_createServerFn = createServerRpc("test_ts--arrowFunction_createServerFn", () => {
        return 'hello';
      });
      const anonymousFunction_createServerFn = createServerRpc("test_ts--anonymousFunction_createServerFn", function () {
        return 'hello';
      });
      const multipleDirectives_multipleDirectives = createServerRpc("test_ts--multipleDirectives_multipleDirectives", function multipleDirectives() {
        'use strict';

        return 'hello';
      });
      const iife_1 = createServerRpc("test_ts--iife_1", function () {
        return 'hello';
      });
      const defaultExportFn_1 = createServerRpc("test_ts--defaultExportFn_1", function defaultExportFn() {
        return 'hello';
      });
      const namedExportFn_1 = createServerRpc("test_ts--namedExportFn_1", function namedExportFn() {
        return 'hello';
      });
      const exportedArrowFunction_wrapper = createServerRpc("test_ts--exportedArrowFunction_wrapper", () => {
        return 'hello';
      });
      const namedExportConst_1 = createServerRpc("test_ts--namedExportConst_1", () => {
        return usedFn();
      });
      function usedFn() {
        return 'hello';
      }
      export { namedFunction_createServerFn_namedFunction, arrowFunction_createServerFn, anonymousFunction_createServerFn, multipleDirectives_multipleDirectives, iife_1, defaultExportFn_1, namedExportFn_1, exportedArrowFunction_wrapper, namedExportConst_1 };"
    `,
    )
  })

  test('Does not support function declarations nested in other blocks', () => {
    const code = `
      outer(() => {
        function useServer() {
          'use server'
          return 'hello'
        }
      })
    `

    expect(() => compileDirectives({ ...clientConfig, code })).toThrow()
    expect(() => compileDirectives({ ...serverConfig, code })).toThrow()
    expect(() =>
      compileDirectives({
        ...serverConfig,
        code,
        filename: serverConfig.filename + `?tsr-serverfn-split=temp`,
      }),
    ).toThrow()
  })

  test('does not support class methods', () => {
    const code = `
      class TestClass {
        method() {
          'use server'
          return 'hello'
        }

        static staticMethod() {
          'use server'
          return 'hello'
        }
      }
    `

    expect(() => compileDirectives({ ...clientConfig, code })).toThrow()
    expect(() => compileDirectives({ ...serverConfig, code })).toThrow()
    expect(() =>
      compileDirectives({
        ...serverConfig,
        code,
        filename: serverConfig.filename + `?tsr-serverfn-split=temp`,
      }),
    ).toThrow()
  })

  test('does not support object methods', () => {
    const code = `
      const obj = {
        method() {
          'use server'
          return 'hello'
        },
      }
    `

    expect(() => compileDirectives({ ...clientConfig, code })).toThrow()
    expect(() => compileDirectives({ ...serverConfig, code })).toThrow()
    expect(() =>
      compileDirectives({
        ...serverConfig,
        code,
        filename: serverConfig.filename + `?tsr-serverfn-split=temp`,
      }),
    ).toThrow()
  })

  test('does not support generator functions', () => {
    const code = `
      function* generatorServer() {
        'use server'
        yield 'hello'
      }

      async function* asyncGeneratorServer() {
        'use server'
        yield 'hello'
      }
    `

    expect(() => compileDirectives({ ...clientConfig, code })).toThrow()
    expect(() => compileDirectives({ ...serverConfig, code })).toThrow()
    expect(() =>
      compileDirectives({
        ...serverConfig,
        code,
        filename: serverConfig.filename + `?tsr-serverfn-split=temp`,
      }),
    ).toThrow()
  })

  test('multiple directiveFnsById', () => {
    const code = `
      function multiDirective() {
        'use strict'
        'use server'
        return 'hello'
      }
    `

    const client = compileDirectives({ ...clientConfig, code })
    const ssr = compileDirectives({ ...ssrConfig, code })

    const server = compileDirectives({
      ...serverConfig,
      code,
      filename:
        ssr.directiveFnsById[Object.keys(ssr.directiveFnsById)[0]!]!
          .extractedFilename,
    })

    expect(client.compiledResult.code).toMatchInlineSnapshot(`
      "import { createClientRpc } from "my-rpc-lib-client";
      createClientRpc("test_ts--multiDirective_1");"
    `)
    expect(ssr.compiledResult.code).toMatchInlineSnapshot(`
      "import { createSsrRpc } from "my-rpc-lib-server";
      createSsrRpc("test_ts--multiDirective_1");"
    `)
    expect(server.compiledResult.code).toMatchInlineSnapshot(`
      "import { createServerRpc } from "my-rpc-lib-server";
      createServerRpc("test_ts--multiDirective_1", function multiDirective() {
        'use strict';

        return 'hello';
      });
      export { multiDirective_1 };"
    `)
  })

  test('IIFE', () => {
    const code = `
      export const iife = (function () {
        'use server'
        return 'hello'
      })()
    `

    const client = compileDirectives({ ...clientConfig, code })
    const ssr = compileDirectives({ ...ssrConfig, code })

    const server = compileDirectives({
      ...serverConfig,
      code,
      filename:
        ssr.directiveFnsById[Object.keys(ssr.directiveFnsById)[0]!]!
          .extractedFilename,
    })

    expect(client.compiledResult.code).toMatchInlineSnapshot(`
      "import { createClientRpc } from "my-rpc-lib-client";
      const iife_1 = createClientRpc("test_ts--iife_1");
      export const iife = iife_1();"
    `)

    expect(ssr.compiledResult.code).toMatchInlineSnapshot(`
      "import { createSsrRpc } from "my-rpc-lib-server";
      const iife_1 = createSsrRpc("test_ts--iife_1");
      export const iife = iife_1();"
    `)

    expect(server.compiledResult.code).toMatchInlineSnapshot(`
      "import { createServerRpc } from "my-rpc-lib-server";
      const iife_1 = createServerRpc("test_ts--iife_1", function () {
        return 'hello';
      });
      export { iife_1 };"
    `)
  })

  test('functions that might have the same functionId', () => {
    const code = `
      outer(function useServer() {
        'use server'
        return 'hello'
      })

      outer(function useServer() {
        'use server'
        return 'hello'
      })
    `

    const client = compileDirectives({ ...clientConfig, code })
    const ssr = compileDirectives({ ...ssrConfig, code })

    const server = compileDirectives({
      ...serverConfig,
      code,
      filename:
        ssr.directiveFnsById[Object.keys(ssr.directiveFnsById)[0]!]!
          .extractedFilename,
    })

    expect(client.compiledResult.code).toMatchInlineSnapshot(`
      "import { createClientRpc } from "my-rpc-lib-client";
      const outer_useServer = createClientRpc("test_ts--outer_useServer");
      outer(outer_useServer);
      const outer_useServer_1 = createClientRpc("test_ts--outer_useServer_1");
      outer(outer_useServer_1);"
    `)

    expect(ssr.compiledResult.code).toMatchInlineSnapshot(`
      "import { createSsrRpc } from "my-rpc-lib-server";
      const outer_useServer = createSsrRpc("test_ts--outer_useServer");
      outer(outer_useServer);
      const outer_useServer_1 = createSsrRpc("test_ts--outer_useServer_1");
      outer(outer_useServer_1);"
    `)

    expect(server.compiledResult.code).toMatchInlineSnapshot(`
      "import { createServerRpc } from "my-rpc-lib-server";
      const outer_useServer = createServerRpc("test_ts--outer_useServer", function useServer() {
        return 'hello';
      });
      outer(outer_useServer);
      const outer_useServer_1 = createServerRpc("test_ts--outer_useServer_1", function useServer() {
        return 'hello';
      });
      outer(outer_useServer_1);
      export { outer_useServer, outer_useServer_1 };"
    `)
  })

  test('use server directive in program body', () => {
    const code = `
      'use server'

      export function useServer() {
        return usedInUseServer()
      }

      function notExported() {
        return 'hello'
      }

      function usedInUseServer() {
        return 'hello'
      }

      export default function defaultExport() {
        return 'hello'
      }
    `

    const client = compileDirectives({ ...clientConfig, code })
    const ssr = compileDirectives({ ...ssrConfig, code })
    const server = compileDirectives({
      ...serverConfig,
      code,
      filename:
        ssr.directiveFnsById[Object.keys(ssr.directiveFnsById)[0]!]!
          .extractedFilename,
    })

    expect(client.compiledResult.code).toMatchInlineSnapshot(`
      "'use server';

      import { createClientRpc } from "my-rpc-lib-client";
      const useServer_1 = createClientRpc("test_ts--useServer_1");
      export const useServer = useServer_1;
      const defaultExport_1 = createClientRpc("test_ts--defaultExport_1");
      export default defaultExport_1;"
    `)
    expect(ssr.compiledResult.code).toMatchInlineSnapshot(`
      "'use server';

      import { createSsrRpc } from "my-rpc-lib-server";
      const useServer_1 = createSsrRpc("test_ts--useServer_1");
      export const useServer = useServer_1;
      const defaultExport_1 = createSsrRpc("test_ts--defaultExport_1");
      export default defaultExport_1;"
    `)
    expect(server.compiledResult.code).toMatchInlineSnapshot(`
      "'use server';

      import { createServerRpc } from "my-rpc-lib-server";
      const useServer_1 = createServerRpc("test_ts--useServer_1", function useServer() {
        return usedInUseServer();
      });
      function usedInUseServer() {
        return 'hello';
      }
      const defaultExport_1 = createServerRpc("test_ts--defaultExport_1", function defaultExport() {
        return 'hello';
      });
      export { useServer_1, defaultExport_1 };"
    `)
  })

  test('createServerFn with identifier', () => {
    // The following code is the client output of the tanstack-start-plugin
    // that compiles `createServerFn` calls to automatically add the `use server`
    // directive in the right places.
    const clientOrSsrCode = `import { createServerFn } from '@tanstack/start';
      export const myServerFn = createServerFn().handler(opts => {
        "use server";

        return myServerFn.__executeServer(opts);
      });
      
      export const myServerFn2 = createServerFn().handler(opts => {
        "use server";

        return myServerFn2.__executeServer(opts);
      });`

    // The following code is the server output of the tanstack-start-plugin
    // that compiles `createServerFn` calls to automatically add the `use server`
    // directive in the right places.
    const serverCode = `import { createServerFn } from '@tanstack/start';
      const myFunc = () => {
        return 'hello from the server'
      };
      export const myServerFn = createServerFn().handler(opts => {
        "use server";
        
        return myServerFn.__executeServer(opts);
      }, myFunc);

      const myFunc2 = () => {
        return myServerFn({ data: 'hello 2 from the server' });
      };
      export const myServerFn2 = createServerFn().handler(opts => {
        "use server";

        return myServerFn2.__executeServer(opts);
      }, myFunc2);`

    const client = compileDirectives({ ...clientConfig, code: clientOrSsrCode })
    const ssr = compileDirectives({ ...ssrConfig, code: clientOrSsrCode })
    const server = compileDirectives({
      ...serverConfig,
      code: serverCode,
      filename:
        ssr.directiveFnsById[Object.keys(ssr.directiveFnsById)[0]!]!
          .extractedFilename,
    })

    expect(client.compiledResult.code).toMatchInlineSnapshot(`
      "import { createClientRpc } from "my-rpc-lib-client";
      import { createServerFn } from '@tanstack/start';
      const myServerFn_createServerFn_handler = createClientRpc("test_ts--myServerFn_createServerFn_handler");
      export const myServerFn = createServerFn().handler(myServerFn_createServerFn_handler);
      const myServerFn2_createServerFn_handler = createClientRpc("test_ts--myServerFn2_createServerFn_handler");
      export const myServerFn2 = createServerFn().handler(myServerFn2_createServerFn_handler);"
    `)

    expect(ssr.compiledResult.code).toMatchInlineSnapshot(`
      "import { createSsrRpc } from "my-rpc-lib-server";
      import { createServerFn } from '@tanstack/start';
      const myServerFn_createServerFn_handler = createSsrRpc("test_ts--myServerFn_createServerFn_handler");
      export const myServerFn = createServerFn().handler(myServerFn_createServerFn_handler);
      const myServerFn2_createServerFn_handler = createSsrRpc("test_ts--myServerFn2_createServerFn_handler");
      export const myServerFn2 = createServerFn().handler(myServerFn2_createServerFn_handler);"
    `)

    expect(server.compiledResult.code).toMatchInlineSnapshot(`
      "import { createServerRpc } from "my-rpc-lib-server";
      import { createServerFn } from '@tanstack/start';
      const myFunc = () => {
        return 'hello from the server';
      };
      const myServerFn_createServerFn_handler = createServerRpc("test_ts--myServerFn_createServerFn_handler", opts => {
        return myServerFn.__executeServer(opts);
      });
      const myFunc2 = () => {
        return myServerFn({
          data: 'hello 2 from the server'
        });
      };
      const myServerFn2_createServerFn_handler = createServerRpc("test_ts--myServerFn2_createServerFn_handler", opts => {
        return myServerFn2.__executeServer(opts);
      });
      const myServerFn = createServerFn().handler(myServerFn_createServerFn_handler, myFunc);
      const myServerFn2 = createServerFn().handler(myServerFn2_createServerFn_handler, myFunc2);
      export { myServerFn_createServerFn_handler, myServerFn2_createServerFn_handler };"
    `)
  })
})
