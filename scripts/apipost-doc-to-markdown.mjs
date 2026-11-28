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
 *   vp run docs:apipost:diff                  # 拉取后与提交的快照比较，不写文件（0 无变化 / 1 有变化 / 2 失败）
 *                                              # 可加 --base <快照目录>、--diff-examples
 *
 * 默认输出 api-reference/<项目英文名>/，目录与文件名一律 ASCII：
 * 目录查 FOLDER_SLUGS，接口文件名取 URL 末段。
 * 注意不能挪进 docs/：apps/docs 的 @nuxt/content 会把路径逐段 slugify，
 * 中文段一律变成空串（“群组”、“加入群组”都是 ""），几十个接口会撞到同一个路径。
 * 仓库是公开的，所以示例参数里的 token / sign 默认打码，用 --keep-secrets 可以保留原值。
 */

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ORIGIN = 'https://docs.apipost.net'
const DEFAULT_DOC_URL = 'https://docs.apipost.net/docs/detail/6d697c60e879000'

function parseArgs(argv) {
  const args = {
    input: '',
    outDir: '',
    single: '',
    keepSecrets: false,
    diff: false,
    diffExamples: false,
    base: '',
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-o' || arg === '--out') args.outDir = argv[++i]
    else if (arg === '--single') args.single = argv[++i]
    else if (arg === '--keep-secrets') args.keepSecrets = true
    else if (arg === '--diff') args.diff = true
    else if (arg === '--diff-examples') args.diffExamples = true
    else if (arg === '--base') {
      const value = argv[++i]
      if (!value) throw new Error('--base 需要一个快照目录')
      args.base = value
    } else if (!args.input) args.input = arg
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

/**
 * 目录名和文件名必须是纯 ASCII。
 *
 * ApiPost 的目录树是中文的，但中文段一旦进了 git 路径，Windows 的 GBK 解码、
 * macOS 的 Unicode 归一化、以及各命令行工具的转义都会让同一个文件对不上。
 * 所以目录查表转英文 slug，接口文件名直接取 URL 末段（本来就是 ASCII）；
 * 查不到的目录直接报错，新增目录要先补一条英文名，而不是悄悄落成中文路径。
 */
const FOLDER_SLUGS = {
  管理员: 'manager',
  围栏: 'geofence',
  轨迹: 'track',
  流量卡: 'simcard',
  提醒: 'reminder',
  紧急联系人: 'emergency-contact',
  设备: 'device',
  好友: 'friend',
  群组: 'group',
}

const asciiSlug = (name) =>
  String(name ?? '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase()

/** 混合名（subuser管理）丢掉中文尾巴，纯中文名查表，其余报错。 */
function folderSlug(name) {
  const trimmed = String(name ?? '').trim()
  const slug = FOLDER_SLUGS[trimmed] || asciiSlug(trimmed)
  if (!slug) throw new Error(`目录名 "${trimmed}" 没有英文 slug，请在 FOLDER_SLUGS 里补一条`)
  return slug
}

/** 接口文件名取 URL 末段（device-get-detail）；没有 URL 时才退回目录名。 */
function endpointSlug(api, fallbackName) {
  const path = String(api?.url || '')
    .split('?')[0]
    .replace(/\/+$/, '')
  const last = path.split('/').filter(Boolean).pop() || ''
  return asciiSlug(last) || folderSlug(fallbackName)
}

/** 上游项目名带“内部”，这份快照在公开仓库里，落盘前去掉。 */
const sanitizeProjectName = (name) =>
  String(name ?? '')
    .replace(/内部/g, '')
    .trim()

/** 输出目录名：英文项目名。 */
const PROJECT_DIRS = { 微喇WEB接口: 'weila-webapi' }
const projectDirName = (title) => PROJECT_DIRS[title] || folderSlug(title)

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
    if (owned) await rm(outDir, { recursive: true, force: true })
  }
  await mkdir(outDir, { recursive: true })
}

const REQUEST_SECTIONS = [
  { name: 'query', read: (api) => api?.request?.query?.parameter },
  { name: 'body', read: (api) => api?.request?.body?.raw_parameter },
  { name: 'header', read: (api) => api?.request?.header?.parameter },
  { name: 'restful', read: (api) => api?.request?.restful?.parameter },
]

// 示例值默认不参与比较：et/appid/token 本来就会轮换，算进去只会天天报变更
const PARAM_FIELDS = ['field_type', 'description', 'not_null']

/** 固定按码点排序，报告顺序不随机器 locale 变化。 */
const compareKeys = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** 报告是给终端看的，一个字段占一行，换行符转义掉。 */
function oneLine(value) {
  const text = String(value ?? '').replace(/\r?\n/g, '\\n')
  return text === '' ? '(empty)' : text
}

/**
 * 契约身份是 method + pathname；origin 单独比较。
 * 换域名（http://localhost → https://api.voischat.cn）是同一接口搬了家，不是删了再加。
 */
function indexEndpoints(raw) {
  const list = raw?.details?.list
  if (!Array.isArray(list)) throw new Error('快照缺少 details.list')
  const endpoints = new Map()
  for (const item of list) {
    if (item?.target_type !== 'api') continue
    const url = String(item.url ?? '').trim()
    let pathname = url.split('?')[0].split('#')[0] || '/'
    let origin = ''
    try {
      const parsed = new URL(url)
      pathname = parsed.pathname || '/'
      origin = parsed.origin
    } catch {
      // 相对地址没有 origin，保留上面的回退 pathname
    }
    const method = String(item.method ?? '').toUpperCase()
    const key = `${method} ${pathname}`
    endpoints.set(key, { key, origin, item })
  }
  return endpoints
}

function paramsByKey(list) {
  const params = new Map()
  for (const param of Array.isArray(list) ? list : []) {
    if (!param || param.key == null) continue
    params.set(String(param.key), param)
  }
  return params
}

/** 响应按 expect.name 分组，同名示例合并（上游极少重名）。 */
function examplesByKey(api) {
  const examples = new Map()
  for (const example of Array.isArray(api?.response?.example) ? api.response.example : []) {
    const name = String(example?.expect?.name || 'default')
    const params = examples.get(name) ?? new Map()
    for (const [key, param] of paramsByKey(example?.raw_parameter)) params.set(key, param)
    examples.set(name, params)
  }
  return examples
}

function compareParam(oldParam, newParam, key, withValues) {
  const changes = []
  const fields = withValues ? [...PARAM_FIELDS, 'value'] : PARAM_FIELDS
  for (const field of fields) {
    const before = String(oldParam?.[field] ?? '')
    const after = String(newParam?.[field] ?? '')
    if (before === after) continue
    // 值字段走和 Markdown 相同的打码规则
    const show = (value) => oneLine(field === 'value' ? exampleValue(key, value) : value)
    changes.push(`${field}: ${show(before)} -> ${show(after)}`)
  }
  return changes
}

function diffParams(oldParams, newParams, describeKey, withValues) {
  const lines = []
  const keys = [...new Set([...oldParams.keys(), ...newParams.keys()])].sort(compareKeys)
  for (const key of keys) {
    const oldParam = oldParams.get(key)
    const newParam = newParams.get(key)
    if (!oldParam) {
      lines.push(`  ${describeKey(key)}`, '    added')
      continue
    }
    if (!newParam) {
      lines.push(`  ${describeKey(key)}`, '    removed')
      continue
    }
    const changes = compareParam(oldParam, newParam, key, withValues)
    if (!changes.length) continue
    lines.push(`  ${describeKey(key)}`, ...changes.map((change) => `    ${change}`))
  }
  return lines
}

function diffEndpoint(oldEndpoint, newEndpoint, withValues) {
  const oldItem = oldEndpoint.item
  const newItem = newEndpoint.item
  const lines = []

  if (oldEndpoint.origin !== newEndpoint.origin)
    lines.push(`  origin  ${oneLine(oldEndpoint.origin)} -> ${oneLine(newEndpoint.origin)}`)
  if (String(oldItem.name ?? '') !== String(newItem.name ?? ''))
    lines.push(`  name  ${oneLine(oldItem.name)} -> ${oneLine(newItem.name)}`)
  if (String(oldItem.description ?? '') !== String(newItem.description ?? ''))
    lines.push(`  description  ${oneLine(oldItem.description)} -> ${oneLine(newItem.description)}`)

  for (const { name, read } of REQUEST_SECTIONS)
    lines.push(
      ...diffParams(
        paramsByKey(read(oldItem)),
        paramsByKey(read(newItem)),
        (key) => `request ${name} ${key}`,
        withValues,
      ),
    )

  const oldExamples = examplesByKey(oldItem)
  const newExamples = examplesByKey(newItem)
  const names = [...new Set([...oldExamples.keys(), ...newExamples.keys()])].sort(compareKeys)
  for (const name of names)
    lines.push(
      ...diffParams(
        oldExamples.get(name) ?? new Map(),
        newExamples.get(name) ?? new Map(),
        (key) => `response ${name}.${key}`,
        withValues,
      ),
    )

  return lines
}

async function readSnapshot(baseDir) {
  const path = join(baseDir, '_raw.json')
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch {
    throw new Error(`找不到快照 ${path}，请先运行 vp run docs:apipost，或用 --base 指定目录`)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`快照 ${path} 不是合法 JSON：${error.message}`)
  }
}

/** --diff：只比较这次拉取的结果，不写仓库。 */
async function runDiff({ details, baseDir, withValues }) {
  const live = indexEndpoints({ details })
  const base = indexEndpoints(await readSnapshot(baseDir))

  const changed = new Map()
  const added = []
  const removed = []
  for (const [key, endpoint] of live) {
    const before = base.get(key)
    if (!before) added.push(key)
    else {
      const lines = diffEndpoint(before, endpoint, withValues)
      if (lines.length) changed.set(key, lines)
    }
  }
  for (const key of base.keys()) if (!live.has(key)) removed.push(key)

  if (!changed.size && !added.length && !removed.length) {
    console.log(`no API changes against ${baseDir}`)
    return 0
  }

  const blocks = []
  for (const key of [...changed.keys()].sort(compareKeys))
    blocks.push([`changed  ${key}`, ...changed.get(key)].join('\n'))
  for (const key of added.sort(compareKeys)) blocks.push(`added    ${key}`)
  for (const key of removed.sort(compareKeys)) blocks.push(`removed  ${key}`)
  console.log(blocks.join('\n'))
  console.log(`${changed.size} endpoint changed, ${added.length} added, ${removed.length} removed`)
  return 1
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  keepSecrets = args.keepSecrets

  if (!args.diff && (args.base || args.diffExamples))
    throw new Error('--base 和 --diff-examples 需要配合 --diff 使用')
  if (args.diff && (args.single || args.outDir))
    throw new Error('--diff 不能和 --single 或 -o/--out 一起使用')

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

  // 快照不进上游的“内部”字样，README 与 _raw.json 用同一个清洗后的名字
  if (tree.project_name) tree.project_name = sanitizeProjectName(tree.project_name)
  const projectName = tree.project_name || ''
  const docTitle = projectName || tree.name || items[0]?.name || 'ApiPost 文档'

  if (args.diff) {
    const baseDir = args.base
      ? resolve(args.base)
      : join(
          fileURLToPath(new URL('..', import.meta.url)),
          'api-reference',
          projectDirName(docTitle),
        )
    const code = await runDiff({ details, baseDir, withValues: args.diffExamples })
    if (code) process.exitCode = code
    return
  }

  // 保留 ApiPost 的目录层级，但每一段都换成 ASCII slug
  const files = new Map()
  const fileNames = new Set()
  const flattened = []

  const assignPaths = (nodes, dir) => {
    for (const node of nodes) {
      if (node.isFolder) {
        assignPaths(node.children, posix.join(dir, folderSlug(node.name)))
        continue
      }
      const folder = dir ? `${dir}/` : ''
      const slug = endpointSlug(issuesById.get(node.id), node.name)
      let relPath = `${folder}${slug}.md`
      for (let suffix = 2; fileNames.has(relPath); suffix++)
        relPath = `${folder}${slug}-${suffix}.md`
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
    args.outDir ||
    join(fileURLToPath(new URL('..', import.meta.url)), 'api-reference', projectDirName(docTitle))
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

// 只有直接执行才跑，方便测试/脚本 import 复用上面的命名规则
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(`失败: ${error.message}`)
    // --diff 用 2 表示拉取/渲染失败；0 是无变更，1 是有变更
    process.exit(process.argv.slice(2).includes('--diff') ? 2 : 1)
  })

export { endpointSlug, folderSlug, projectDirName, sanitizeProjectName }
