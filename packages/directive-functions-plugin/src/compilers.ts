import * as babel from '@babel/core'
import _generate from '@babel/generator'
import { parse } from '@babel/parser'
import { isIdentifier, isVariableDeclarator } from '@babel/types'
import { codeFrameColumns } from '@babel/code-frame'
import { deadCodeElimination } from 'babel-dead-code-elimination'
import type { ParseResult } from '@babel/parser'

let generate = _generate

if ('default' in generate) {
  generate = generate.default as typeof generate
}

export interface DirectiveFn {
  nodePath: SupportedFunctionPath
  functionName: string
  functionId: string
  extractedFilename: string
  filename: string
  chunkName: string
}

export type SupportedFunctionPath =
  | babel.NodePath<babel.types.FunctionDeclaration>
  | babel.NodePath<babel.types.FunctionExpression>
  | babel.NodePath<babel.types.ArrowFunctionExpression>

export type ReplacerFn = (opts: {
  fn: string
  extractedFilename: string
  filename: string
  functionId: string
  isSourceFn: boolean
}) => string

// const debug = process.env.TSR_VITE_DEBUG === 'true'

export type CompileDirectivesOpts = ParseAstOptions & {
  directive: string
  directiveLabel: string
  getRuntimeCode?: (opts: {
    directiveFnsById: Record<string, DirectiveFn>
  }) => string
  replacer: ReplacerFn
  // devSplitImporter: string
}

export type ParseAstOptions = {
  code: string
  filename: string
  root: string
}

export function parseAst(opts: ParseAstOptions): ParseResult<babel.types.File> {
  return parse(opts.code, {
    plugins: ['jsx', 'typescript'],
    sourceType: 'module',
    ...{
      root: opts.root,
      filename: opts.filename,
      sourceMaps: true,
    },
  })
}

function buildDirectiveSplitParam(opts: CompileDirectivesOpts) {
  return `tsr-directive-${opts.directive.replace(/[^a-zA-Z0-9]/g, '-')}`
}

export function compileDirectives(opts: CompileDirectivesOpts) {
  const directiveSplitParam = buildDirectiveSplitParam(opts)
  const isDirectiveSplitParam = opts.filename.includes(directiveSplitParam)

  const ast = parseAst(opts)
  const directiveFnsById = findDirectives(ast, {
    ...opts,
    directiveSplitParam,
  })

  const directiveFnsByFunctionName = Object.fromEntries(
    Object.entries(directiveFnsById).map(([, fn]) => [fn.functionName, fn]),
  )

  // Add runtime code if there are directives
  if (Object.keys(directiveFnsById).length > 0) {
    // // Add a vite import to the top of the file
    // ast.program.body.unshift(
    //   babel.types.importDeclaration(
    //     [babel.types.importDefaultSpecifier(babel.types.identifier('vite'))],
    //     babel.types.stringLiteral('vite'),
    //   ),
    // )

    if (opts.getRuntimeCode) {
      const runtimeImport = babel.template.statement(
        opts.getRuntimeCode({ directiveFnsById }),
      )()
      ast.program.body.unshift(runtimeImport)
    }
  }

  // If we are in the source file, we need to remove all exports
  // then make sure that all of our functions are exported under their
  // directive name
  if (isDirectiveSplitParam) {
    safeRemoveExports(ast)

    // Export a single object with all of the functions
    // e.g. export { directiveFn1, directiveFn2 }
    ast.program.body.push(
      babel.types.exportNamedDeclaration(
        undefined,
        Object.values(directiveFnsByFunctionName).map((fn) =>
          babel.types.exportSpecifier(
            babel.types.identifier(fn.functionName),
            babel.types.identifier(fn.functionName),
          ),
        ),
      ),
    )
  }

  deadCodeElimination(ast)

  const compiledResult = generate(ast, {
    sourceMaps: true,
    sourceFileName: opts.filename,
    minified: process.env.NODE_ENV === 'production',
  })

  return {
    compiledResult,
    directiveFnsById,
  }
}

function findNearestVariableName(
  path: babel.NodePath,
  directiveLabel: string,
): string {
  let currentPath: babel.NodePath | null = path
  const nameParts: Array<string> = []

  while (currentPath) {
    const name = (() => {
      // Check for named function expression
      if (
        babel.types.isFunctionExpression(currentPath.node) &&
        currentPath.node.id
      ) {
        return currentPath.node.id.name
      }

      // Handle method chains
      if (babel.types.isCallExpression(currentPath.node)) {
        const current = currentPath.node.callee
        const chainParts: Array<string> = []

        // Get the nearest method name (if it's a method call)
        if (babel.types.isMemberExpression(current)) {
          if (babel.types.isIdentifier(current.property)) {
            chainParts.unshift(current.property.name)
          }

          // Get the base callee
          let base = current.object
          while (!babel.types.isIdentifier(base)) {
            if (babel.types.isCallExpression(base)) {
              base = base.callee as babel.types.Expression
            } else if (babel.types.isMemberExpression(base)) {
              base = base.object
            } else {
              break
            }
          }
          if (babel.types.isIdentifier(base)) {
            chainParts.unshift(base.name)
          }
        } else if (babel.types.isIdentifier(current)) {
          chainParts.unshift(current.name)
        }

        if (chainParts.length > 0) {
          return chainParts.join('_')
        }
      }

      // Rest of the existing checks...
      if (babel.types.isFunctionDeclaration(currentPath.node)) {
        return currentPath.node.id?.name
      }

      if (babel.types.isIdentifier(currentPath.node)) {
        return currentPath.node.name
      }

      if (
        isVariableDeclarator(currentPath.node) &&
        isIdentifier(currentPath.node.id)
      ) {
        return currentPath.node.id.name
      }

      if (
        babel.types.isClassMethod(currentPath.node) ||
        babel.types.isObjectMethod(currentPath.node)
      ) {
        throw new Error(
          `${directiveLabel} in ClassMethod or ObjectMethod not supported`,
        )
      }

      return ''
    })()

    if (name) {
      nameParts.unshift(name)
    }

    currentPath = currentPath.parentPath
  }

  return nameParts.length > 0 ? nameParts.join('_') : 'anonymous'
}

function makeFileLocationUrlSafe(location: string): string {
  return location
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace unsafe chars with underscore
    .replace(/_{2,}/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Trim leading/trailing underscores
    .replace(/_--/g, '--') // Clean up the joiner
}

function makeIdentifierSafe(identifier: string): string {
  return identifier
    .replace(/[^a-zA-Z0-9_$]/g, '_') // Replace unsafe chars with underscore
    .replace(/^[0-9]/, '_$&') // Prefix leading number with underscore
    .replace(/^\$/, '_$') // Prefix leading $ with underscore
    .replace(/_{2,}/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Trim leading/trailing underscores
}

export function findDirectives(
  ast: babel.types.File,
  opts: ParseAstOptions & {
    directive: string
    directiveLabel: string
    replacer?: ReplacerFn
    directiveSplitParam: string
  },
) {
  const directiveFnsById: Record<string, DirectiveFn> = {}
  const functionNameSet: Set<string> = new Set()

  let programPath: babel.NodePath<babel.types.Program>

  babel.traverse(ast, {
    Program(path) {
      programPath = path
    },
  })

  // Does the file have the directive in the program body?
  const hasFileDirective = ast.program.directives.some(
    (directive) => directive.value.value === opts.directive,
  )

  // If the entire file has a directive, we need to compile all of the functions that are
  // exported by the file.
  if (hasFileDirective) {
    // Find all of the exported functions
    // They must be either function declarations or const function/anonymous function declarations
    babel.traverse(ast, {
      ExportDefaultDeclaration(path) {
        if (babel.types.isFunctionDeclaration(path.node.declaration)) {
          compileDirective(path.get('declaration') as SupportedFunctionPath)
        }
      },
      ExportNamedDeclaration(path) {
        if (babel.types.isFunctionDeclaration(path.node.declaration)) {
          compileDirective(path.get('declaration') as SupportedFunctionPath)
        }
      },
    })
  } else {
    // Find all directives
    babel.traverse(ast, {
      DirectiveLiteral(nodePath) {
        if (nodePath.node.value === opts.directive) {
          const directiveFn = nodePath.findParent((p) => p.isFunction()) as
            | SupportedFunctionPath
            | undefined

          if (!directiveFn) return

          // Handle class and object methods which are not supported
          const isGenerator =
            directiveFn.isFunction() && directiveFn.node.generator

          const isClassMethod = directiveFn.isClassMethod()
          const isObjectMethod = directiveFn.isObjectMethod()

          if (isClassMethod || isObjectMethod || isGenerator) {
            throw codeFrameError(
              opts.code,
              directiveFn.node.loc,
              `"${opts.directive}" in ${isClassMethod ? 'class' : isObjectMethod ? 'object method' : 'generator function'} not supported`,
            )
          }

          // If the function is inside another block that isn't the program,
          // Error out. This is not supported.
          const nearestBlock = directiveFn.findParent(
            (p) => (p.isBlockStatement() || p.isScopable()) && !p.isProgram(),
          )

          if (nearestBlock) {
            throw codeFrameError(
              opts.code,
              nearestBlock.node.loc,
              `${opts.directiveLabel}s cannot be nested in other blocks or functions`,
            )
          }

          if (
            !directiveFn.isFunctionDeclaration() &&
            !directiveFn.isFunctionExpression() &&
            !(
              directiveFn.isArrowFunctionExpression() &&
              babel.types.isBlockStatement(directiveFn.node.body)
            )
          ) {
            throw codeFrameError(
              opts.code,
              directiveFn.node.loc,
              `${opts.directiveLabel}s must be function declarations or function expressions`,
            )
          }

          compileDirective(directiveFn)
        }
      },
    })
  }

  return directiveFnsById

  function compileDirective(directiveFn: SupportedFunctionPath) {
    // Remove the directive directive from the function body
    if (
      babel.types.isFunction(directiveFn.node) &&
      babel.types.isBlockStatement(directiveFn.node.body)
    ) {
      directiveFn.node.body.directives =
        directiveFn.node.body.directives.filter(
          (directive) => directive.value.value !== opts.directive,
        )
    }

    // Find the nearest variable name
    let functionName = findNearestVariableName(directiveFn, opts.directiveLabel)

    const incrementFunctionNameVersion = (functionName: string) => {
      const [realReferenceName, count] = functionName.split(/_(\d+)$/)
      const resolvedCount = Number(count || '0')
      const suffix = `_${resolvedCount + 1}`
      return makeIdentifierSafe(realReferenceName!) + suffix
    }

    while (functionNameSet.has(functionName)) {
      functionName = incrementFunctionNameVersion(functionName)
    }

    functionNameSet.add(functionName)

    while (programPath.scope.hasBinding(functionName)) {
      functionName = incrementFunctionNameVersion(functionName)
      programPath.scope.crawl()
    }

    functionNameSet.add(functionName)

    // Move the function to program level while preserving its position
    // in the program body
    const programBody = programPath.node.body

    const topParent =
      directiveFn.findParent((p) => !!p.parentPath?.isProgram()) || directiveFn

    const topParentIndex = programBody.indexOf(topParent.node as any)

    // If the reference name came from the function declaration,
    // // We need to update the function name to match the reference name
    // if (babel.types.isFunctionDeclaration(directiveFn.node)) {
    //   directiveFn.node.id!.name = functionName
    // }

    // If the function has a parent that isn't the program,
    // we need to replace it with an identifier and
    // hoist the function to the top level as a const declaration
    if (!directiveFn.parentPath.isProgram()) {
      // Then place the function at the top level
      programBody.splice(
        topParentIndex,
        0,
        babel.types.variableDeclaration('const', [
          babel.types.variableDeclarator(
            babel.types.identifier(functionName),
            babel.types.toExpression(directiveFn.node as any),
          ),
        ]),
      )

      // If it's an exported named function, we need to swap it with an
      // export const originalFunctionName = functionName
      if (
        babel.types.isExportNamedDeclaration(directiveFn.parentPath.node) &&
        (babel.types.isFunctionDeclaration(directiveFn.node) ||
          babel.types.isFunctionExpression(directiveFn.node)) &&
        babel.types.isIdentifier(directiveFn.node.id)
      ) {
        const originalFunctionName = directiveFn.node.id.name
        programBody.splice(
          topParentIndex + 1,
          0,
          babel.types.exportNamedDeclaration(
            babel.types.variableDeclaration('const', [
              babel.types.variableDeclarator(
                babel.types.identifier(originalFunctionName),
                babel.types.identifier(functionName),
              ),
            ]),
          ),
        )

        directiveFn.remove()
      } else {
        directiveFn.replaceWith(babel.types.identifier(functionName))
      }

      directiveFn = programPath.get(
        `body.${topParentIndex}.declarations.0.init`,
      ) as SupportedFunctionPath
    }

    const [baseFilename, ..._searchParams] = opts.filename.split('?')
    const searchParams = new URLSearchParams(_searchParams.join('&'))
    searchParams.set(opts.directiveSplitParam, '')

    const extractedFilename = `${baseFilename}?${searchParams.toString()}`

    const functionId = makeFileLocationUrlSafe(
      `${baseFilename}--${functionName}`.replace(opts.root, ''),
    )

    // If a replacer is provided, replace the function with the replacer
    if (opts.replacer) {
      const replacer = opts.replacer({
        fn: '$$fn$$',
        extractedFilename,
        filename: opts.filename,
        functionId,
        isSourceFn: !!opts.directiveSplitParam,
      })

      const replacement = babel.template.expression(replacer, {
        placeholderPattern: false,
        placeholderWhitelist: new Set(['$$fn$$']),
      })({
        ...(replacer.includes('$$fn$$')
          ? { $$fn$$: babel.types.toExpression(directiveFn.node) }
          : {}),
      })

      directiveFn.replaceWith(replacement)
    }

    // Finally register the directive to
    // our map of directives
    directiveFnsById[functionId] = {
      nodePath: directiveFn,
      functionName,
      functionId,
      extractedFilename,
      filename: opts.filename,
      chunkName: fileNameToChunkName(opts.root, extractedFilename),
    }
  }
}

function codeFrameError(
  code: string,
  loc:
    | {
        start: { line: number; column: number }
        end: { line: number; column: number }
      }
    | undefined
    | null,
  message: string,
) {
  if (!loc) {
    return new Error(`${message} at unknown location`)
  }

  const frame = codeFrameColumns(
    code,
    {
      start: loc.start,
      end: loc.end,
    },
    {
      highlightCode: true,
      message,
    },
  )

  return new Error(frame)
}

const safeRemoveExports = (ast: babel.types.File) => {
  const programBody = ast.program.body

  const removeExport = (
    path:
      | babel.NodePath<babel.types.ExportDefaultDeclaration>
      | babel.NodePath<babel.types.ExportNamedDeclaration>,
  ) => {
    // If the value is a function declaration, class declaration, or variable declaration,
    // That means it has a name and can remain in the file, just unexported.
    if (
      babel.types.isFunctionDeclaration(path.node.declaration) ||
      babel.types.isClassDeclaration(path.node.declaration) ||
      babel.types.isVariableDeclaration(path.node.declaration)
    ) {
      // If the value is a function declaration, class declaration, or variable declaration,
      // That means it has a name and can remain in the file, just unexported.
      if (
        babel.types.isFunctionDeclaration(path.node.declaration) ||
        babel.types.isClassDeclaration(path.node.declaration) ||
        babel.types.isVariableDeclaration(path.node.declaration)
      ) {
        // Move the declaration to the top level at the same index
        const insertIndex = programBody.findIndex(
          (node) => node === path.node.declaration,
        )
        programBody.splice(insertIndex, 0, path.node.declaration as any)
      }
    }

    // Otherwise, remove the export declaration
    path.remove()
  }

  // Before we add our export, remove any other exports.
  // Don't remove the thing they export, just the export declaration
  babel.traverse(ast, {
    ExportDefaultDeclaration(path) {
      removeExport(path)
    },
    ExportNamedDeclaration(path) {
      removeExport(path)
    },
  })
}

function fileNameToChunkName(root: string, fileName: string) {
  // Replace anything that can't go into an import statement
  return fileName.replace(root, '').replace(/[^a-zA-Z0-9_]/g, '_')
}
