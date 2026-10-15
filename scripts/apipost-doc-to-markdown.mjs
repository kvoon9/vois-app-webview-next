#!/usr/bin/env node
/**
 * ApiPost 分享文档 → Markdown。
 *
 * 文档站是 umi SPA，HTML 里没有正文；但它自己用的两个公开 JSON 接口不需要登录：
 *   GET  /doc/preview?issue_id=<id>                 → 目录树（name/method/url）
 *   POST /doc/details {issue_id, target_ids[]}      → 批量完整定义（参数、响应示例）
 * 因此一次预览 + 一次批量详情即可拿全，不必抓页面。
 *
 * 用法:
 *   vp run docs:apipost                       # 用内置的默认分享链接
 *   node scripts/apipost-doc-to-markdown.mjs <文档URL|issue_id> [-o 输出目录] [--single 文件名]
 *
 * 默认输出 api-reference/<项目名>/，保留 ApiPost 的中文目录层级。
 * 注意不能挪进 docs/：apps/docs 的 @nuxt/content 会把路径逐段 slugify，
 * 中文段一律变成空串（“群组”、“加入群组”都是 ""），几十个接口会撞到同一个路径。
 * 仓库是公开的，所以示例参数里的 token / sign 默认打码，用 --keep-secrets 可以保留原值。
 */

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const ORIGIN = 'https://docs.apipost.net'
const DEFAULT_DOC_URL = 'https://docs.apipost.net/docs/detail/6d697c60e879000'

function parseArgs(argv) {
  const args = { input: '', outDir: '', single: '', keepSecrets: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-o' || arg === '--out') args.outDir = argv[++i]
    else if (arg === '--single') args.single = argv[++i]
    else if (arg === '--keep-secrets') args.keepSecrets = true
    else if (!args.input) args.input = arg
  }
  return args
}

/** 文档链接里的 issue_id 就是分享 id；也允许直接传 issue_id。 */
function extractIssueId(input) {
  const fromQuery = input.match(/[?&]issue_id=([\w-]+)/)?.[1]
  if (fromQuery) return fromQuery
  const fromPath = input.match(/\/docs\/detail\/([\w-]+)/)?.[1]
  if (fromPath) return fromPath
  if (/^[\w-]+$/.test(input)) return input
  throw new Error(`无法从 "${input}" 解析 issue_id`)
}

async function getJson(path) {
  const response = await fetch(ORIGIN + path)
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`)
  const json = await response.json()
  if (json.code !== 0) throw new Error(`${path} 返回 code=${json.code} msg=${json.msg}`)
  return json.data
}

async function postJson(path, payload) {
  const response = await fetch(ORIGIN + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`)
  const json = await response.json()
  if (json.code !== 0) throw new Error(`${path} 返回 code=${json.code} msg=${json.msg}`)
  return json.data
}

const getTree = (issueId) => getJson(`/doc/preview?issue_id=${encodeURIComponent(issueId)}`)
const getDetails = (issueId, targetIds) =>
  postJson('/doc/details', { issue_id: issueId, target_ids: targetIds })

/** 表格单元格里的 | 和换行会破坏 Markdown 结构。 */
const cell = (value) =>
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')

/** 目录名和文件名里的 / 与保留字符会变成非法路径或意外层级。 */
const safeName = (name) => (name || '未命名').replace(/[/\\:*?"<>|]/g, '_').trim()

/** 凭据类参数名：值只是文档快照，泄露无益，公开仓库里默认打码。 */
const SECRET_KEY =
  /(token|secret|password|passwd|sign|signature|api[-_]?key|access[-_]?key|private[-_]?key)/i

let keepSecrets = false
const exampleValue = (key, value) =>
  keepSecrets || !value || !SECRET_KEY.test(String(key)) ? value : '***'

/** URL 行里的 token / sign 同样只展示占位符。 */
function maskQuery(query) {
  if (!query || keepSecrets) return query
  const masked = new URLSearchParams()
  for (const [key, value] of new URLSearchParams(query))
    masked.set(key, SECRET_KEY.test(key) ? '***' : value)
  return masked.toString()
}

/**
 * raw_parameter 的 key 已经是完整点号路径（如 data.users.created_at），
 * 直接用原样展示：和 ApiPost 页面一致，拷贝出来就能拿去写代码，
 * 也不用依赖 nbsp 缩进或树形符号在表格里对齐。
 */
function renderParamTable(params, requiredLabel = '必填') {
  if (!params?.length) return ''

  const rows = params.map((param) => {
    const required = Number(param.not_null) === 1 ? '是' : ''
    const type = param.field_type || param.schema?.type || ''
    return `| ${cell(param.key)} | ${cell(type)} | ${required} | ${cell(param.description)} | ${cell(exampleValue(param.key, param.value))} |`
  })

  return [
    `| 参数 | 类型 | ${requiredLabel} | 说明 | 示例 |`,
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n')
}

function renderExamples(examples) {
  if (!examples?.length) return ''

  const blocks = []
  for (const example of examples) {
    const title = example.expect?.name || `示例 ${example.example_id}`
    const parts = [`### ${title}`]
    if (example.raw?.trim()) parts.push(['```json', example.raw.trim(), '```'].join('\n'))
    // 响应里的 not_null 表示“必返”，不是请求侧的可选性
    const table = renderParamTable(example.raw_parameter, '非空')
    if (table) parts.push(`**响应字段**\n\n${table}`)
    blocks.push(parts.join('\n\n'))
  }
  return blocks.join('\n\n')
}

function renderEndpoint(api, breadcrumb) {
  const url = api.url || ''
  const [base, query = ''] = url.split('?')
  const lines = [
    '---',
    `title: ${api.name}`,
    `description: ${[breadcrumb.join(' / '), `${api.method} ${base}`].filter(Boolean).join(' · ')}`,
    '---',
    '',
    `# ${api.name}`,
    '',
  ]

  if (breadcrumb.length) lines.push(`> 目录：${breadcrumb.join(' / ')}`, '')

  lines.push(
    '## 基本信息',
    '',
    '| 项 | 值 |',
    '| --- | --- |',
    `| 请求方法 | \`${api.method}\` |`,
    `| 请求地址 | \`${base}\` |`,
  )
  if (query) {
    // 链接里的示例参数通常带 token，单独列出便于复制时替换
    lines.push(`| 示例参数 | \`${maskQuery(query)}\` |`)
  }
  if (api.description?.trim()) lines.push('', api.description.trim())

  const sections = []
  const section = (title, body) => {
    if (body) sections.push(`## ${title}\n\n${body}`)
  }
  section('请求 Query 参数', renderParamTable(api.request?.query?.parameter))
  section('路径参数', renderParamTable(api.request?.restful?.parameter))
  section('请求 Header', renderParamTable(api.request?.header?.parameter))
  section('请求 Cookie', renderParamTable(api.request?.cookie?.parameter))

  const body = api.request?.body
  if (body?.mode === 'json' || body?.mode === 'raw') {
    section('请求 Body (JSON)', renderParamTable(body.raw_parameter))
    if (body.raw?.trim()) section('请求 Body 示例', ['```json', body.raw.trim(), '```'].join('\n'))
  }

  section('响应示例', renderExamples(api.response?.example))

  if (sections.length) lines.push('', sections.join('\n\n'))

  return `${lines.join('\n').trimEnd()}\n`
}

function buildBreadcrumbs(detailsById, treeById) {
  const byId = new Map([...treeById].map(([id, item]) => [id, item]))
  return (id) => {
    const names = []
    let current = byId.get(id)
    const seen = new Set()
    while (current && !seen.has(current.target_id)) {
      seen.add(current.target_id)
      if (current.target_id !== id) names.unshift(current.name)
      current = current.parent_id
        ? (byId.get(current.parent_id) ?? detailsById.get(current.parent_id))
        : null
    }
    return names.filter(Boolean)
  }
}

function renderIndex({ children, depth = 0, base = '.', link = true }) {
  const lines = []
  const indent = '  '.repeat(depth)
  for (const node of children) {
    const name = cell(node.name)
    if (node.isFolder) {
      lines.push(`${indent}- **${name}**`)
      lines.push(...renderIndex({ children: node.children, depth: depth + 1, base, link }))
    } else {
      // 单文件模式没有可跳转的文件路径，只列出名称
      const label = link ? `[${name}](${base}/${node.relPath})` : name
      lines.push(
        `${indent}- ${label} ${node.method ? `\`${node.method}\`` : ''} \`${node.shortUrl}\``,
      )
    }
  }
  return lines
}

async function writeFileEnsured(path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')
}

/**
 * 输出目录可能指向用户自己的目录，不能无条件递归删除。
 * 只有仓库里发现了上一次生成的 _raw.json 时才认为可以清空。
 */
async function prepareOutDir(outDir) {
  const manifestPath = join(outDir, '_raw.json')
  const exists = await stat(outDir).then(
    () => true,
    () => false,
  )
  if (exists) {
    const entries = await readdir(outDir)
    // 只认带着 source 的清单；普通目录一律拒绝，避免误删
    const owned =
      entries.includes('_raw.json') &&
      (await readFile(manifestPath, 'utf8')
        .then((text) => Boolean(JSON.parse(text)?.source))
        .catch(() => false))
    if (!owned && entries.length)
      throw new Error(`输出目录 ${outDir} 非空且不是本脚本生成的，请换一个目录或先清空`)
    if (owned) {
      const { rm } = await import('node:fs/promises')
      await rm(outDir, { recursive: true, force: true })
    }
  }
  await mkdir(outDir, { recursive: true })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  keepSecrets = args.keepSecrets
  // 不带参数时用内置的固定分享，方便 vp run docs:apipost 直接可用
  const input = args.input || DEFAULT_DOC_URL

  const issueId = extractIssueId(input)
  const tree = await getTree(issueId)
  const items = tree.list ?? []
  if (!items.length) throw new Error('目录为空：该分享可能已过期或未公开')

  const details = await getDetails(
    issueId,
    items.map((item) => item.target_id),
  )
  const detailsById = new Map((details.list ?? []).map((item) => [item.target_id, item]))
  const treeById = new Map(items.map((item) => [item.target_id, item]))

  const breadcrumbsFor = buildBreadcrumbs(detailsById, treeById)
  const issuesById = new Map(detailsById)

  // 目录树：folders 由 parent_id 组装，接口挂在所属目录下
  const rootNodes = []
  const nodesById = new Map()
  const ensureNode = (item) => {
    if (nodesById.has(item.target_id)) return nodesById.get(item.target_id)
    const node = {
      id: item.target_id,
      name: item.name,
      isFolder: item.target_type !== 'api',
      children: [],
      shortUrl: (item.url || '').split('?')[0],
      method: item.method,
    }
    nodesById.set(item.target_id, node)
    return node
  }
  const attach = (item) => {
    const node = ensureNode(item)
    const parentId = item.parent_id && item.parent_id !== '0' ? item.parent_id : null
    const parentItem = parentId ? (treeById.get(parentId) ?? issuesById.get(parentId)) : null
    if (parentItem && parentItem.target_type !== 'api') ensureNode(parentItem).children.push(node)
    else rootNodes.push(node)
    return node
  }
  for (const item of items) attach(item)

  const sortNodes = (nodes) => {
    nodes.sort(
      (a, b) =>
        Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name, 'zh-Hans-CN'),
    )
    for (const node of nodes) sortNodes(node.children)
  }
  sortNodes(rootNodes)

  const projectName = tree.project_name || ''
  const docTitle = projectName || tree.name || items[0]?.name || 'ApiPost 文档'

  // 保留 ApiPost 的中文目录层级
  const files = new Map()
  const fileNames = new Set()
  const flattened = []

  const assignPaths = (nodes, dir) => {
    for (const node of nodes) {
      if (node.isFolder) {
        assignPaths(node.children, posix.join(dir, safeName(node.name)))
        continue
      }
      const folder = dir ? `${dir}/` : ''
      let relPath = `${folder}${safeName(node.name)}.md`
      for (let suffix = 2; fileNames.has(relPath); suffix++)
        relPath = `${folder}${safeName(node.name)}-${suffix}.md`
      fileNames.add(relPath)
      node.relPath = relPath
      files.set(relPath, renderEndpoint(issuesById.get(node.id), breadcrumbsFor(node.id)))
      flattened.push(node)
    }
  }
  assignPaths(rootNodes, '')

  if (args.single) {
    const parts = [`# ${docTitle}`, '']
    parts.push('## 目录', '', ...renderIndex({ children: rootNodes, base: '.', link: false }), '')
    for (const node of flattened) {
      const body = renderEndpoint(issuesById.get(node.id), breadcrumbsFor(node.id))
        .replace(/^---\n[\s\S]*?\n---\n/, '')
        .replace(/^# /, '## ')
      parts.push('---', '', body)
    }
    await writeFileEnsured(args.single, `${parts.join('\n').trimEnd()}\n`)
    console.log(`已生成 ${args.single}（${flattened.length} 个接口）`)
    return
  }

  // 不能放进 docs/：apps/docs 的 @nuxt/content 会把路径逐段 slugify，中文段一律变空串
  const outDir =
    args.outDir || join(fileURLToPath(new URL('..', import.meta.url)), 'api-reference', docTitle)
  const source = `${ORIGIN}/docs/detail/${issueId}`
  await prepareOutDir(outDir)
  for (const [relPath, content] of files) await writeFileEnsured(join(outDir, relPath), content)

  const indexLines = [
    '---',
    `title: ${docTitle}`,
    'description: ApiPost 分享文档的 Markdown 快照',
    '---',
    '',
    `# ${docTitle}`,
    '',
  ]
  indexLines.push(`> 来源：\`${source}\`  ·  拉取于 ${new Date().toISOString().slice(0, 10)}`, '')
  indexLines.push(
    `共 ${flattened.length} 个接口，由 \`vp run docs:apipost\` 生成，请勿手改。`,
    '',
    ...renderIndex({ children: rootNodes, base: '.' }),
    '',
  )
  await writeFileEnsured(join(outDir, 'README.md'), `${indexLines.join('\n').trimEnd()}\n`)

  // _raw.json 既是原始数据，也是下次运行的归属凭据，不参与文档站渲染
  await writeFileEnsured(
    join(outDir, '_raw.json'),
    `${JSON.stringify({ source, generated_at: new Date().toISOString(), issue_id: issueId, tree, details }, null, 2)}\n`,
  )

  console.log(
    `已生成 ${flattened.length} 个接口 → ${outDir}/（README.md 为索引，_raw.json 为原始数据）`,
  )
}

main().catch((error) => {
  console.error(`失败: ${error.message}`)
  process.exit(1)
})
