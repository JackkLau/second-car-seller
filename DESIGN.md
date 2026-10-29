---
version: alpha
name: 见车
description: 以车辆档案和清晰费用为中心的中文二手车选购体验。
colors:
  primary: "#0b6e62"
  primary-hover: "#08574e"
  ink: "#183340"
  muted: "#526972"
  canvas: "#f4f7f8"
  surface: "#ffffff"
  line: "#dce5e7"
  mint: "#e8f3ee"
  warning: "#895812"
  warning-bg: "#fff5e4"
  danger: "#ac3b42"
typography:
  display:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif'
  body:
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
  numeric:
    fontFamily: '"Avenir Next", "Segoe UI", sans-serif'
rounded:
  DEFAULT: "12px"
  sm: "8px"
  lg: "20px"
  hero: "24px"
spacing:
  section-gap: "40px"
  page-max: "1320px"
  card-gap: "22px"
components:
  button: {}
  card: {}
  dialog: {}
  select: {}
---

# 见车 Design System

## Overview

见车是一个面向中文个人购车者的 React 示例。用户在手机或电脑上筛选、比较和核对二手车信息，随后体验预约。当前任务的业务依据是对话中明确的商品展示与获客建议，不包含支付、金融审批、账户或真实经销商预约。

视觉参考来自车辆档案、检验单和旅行途中明亮的展厅：信息有秩序，照片保留自然环境，数字容易比较。产品页面采用青绿色操作色、深海蓝文字与冷白背景。标志性细节是卡片中独立的“车况记录”条，以及详情中的分项费用清单。除这两个信息结构外保持克制，不采用倒计时、虚构浏览人数和夸张降价。

界面语言为 zh-CN；金额人民币；日程显示使用 Asia/Hong_Kong。图片为车型示意，所有车源、车况、价格与预约都为虚构演示，页面和预约表单明确标记。

Runtime ownership: Model B. `src/styles/tokens.css` is the canonical runtime token source. This document mirrors those accepted values. All components consume CSS variables; there is no separate Tailwind or JavaScript theme. A seed project has no previous sibling design to preserve; card, detail, compare and form share the same controls.

## Colors

Primary is reserved for selection and meaningful actions. Ink is used for headings and prices. Muted text remains readable on both white and canvas. Mint indicates documented information; warnings use both an icon/text and warning color. Danger is reserved for errors. This release has one light theme; forced-colors uses system colors.

## Typography

Display uses the native Chinese-capable stack above at up to 47px on desktop and 28px on phones. Body copy is 14–16px with 1.6 line-height; catalog metadata is 12px and supporting captions are 10–11px. Numeric prices use tabular numerals and a separate numeric stack. Chinese text wraps naturally without letter-spacing in dense rows. Font files are not downloaded, avoiding late font swaps and preserving offline operation.

## Layout

The shell is centered at 1320px. A short split photo introduction leads directly into the catalog. A 222px filter rail and three-column vehicle grid serve wide desktops. At 1180px the grid becomes two columns. At 900px filters move into the shared dialog. At 600px cards use one column and the introduction becomes a compact text block so inventory reaches the initial phone viewport; the featured car remains available in the catalog. The page owns vertical scrolling; compare tables may scroll horizontally inside their dialog. Image aspect ratios reserve space. The comparison bar is fixed without obscuring the final card.

## Elevation & Depth

Cards use quiet borders and a small hover elevation; dialogs and the comparison bar have stronger shadow. Inspection and price blocks use tonal surfaces rather than stacked decorative boxes. No glass blur or gradients are required for core content.

## Shapes

Controls use 8–12px corners; vehicle cards use 16px and the introduction 24px. Pills are reserved for category selection and concise badges. Line icons share a 1.7px stroke, generally 18px or 20px.

## Components

Buttons have solid, outline and ghost emphasis; the same action retains its name and behavior across card, detail and compare. All enabled controls have hover, pressed and focus-visible treatment. Disabled controls retain their geometry and show an explanation when needed. Native select popups deliberately use OS-owned geometry and keyboard interaction.

`Modal` owns dialog focus, Escape, background isolation and restoration. `Toast` owns transient live-region messages. `Filters` is shared between desktop and phone layouts. `AppointmentDialog` owns validation and local-only simulated submission; it preserves drafts while closed and never persists contact data. See `UX-CONTRACT.md` for behavior.

`NeedsProfile` adds a compact, native disclosure above catalog categories; its optional select form uses two columns on desktop and one on phones. Recommendation reasons reuse mint information surfaces; mismatches and unresolved evidence use warning text and surfaces, never a numeric safety or match badge. `InspectionRecords` separates recorded evidence, findings, pending checks and unverified documents. `VehicleGuidance` uses selectable tasks with progressive disclosure for practical steps, sales cooperation and costs; unknown quotes never resemble confirmed totals. `VisitPlanSummary` carries the same wording into appointment and confirmation. These additions preserve the existing palette, tokens, controls and scroll ownership; the feature introduces no visual-token changes.

Icons: lucide-react. All icon-only actions have Chinese accessible names. Motion: 160–220ms opacity/transform feedback; reduced-motion removes animation and smooth scrolling. No automatic video.

Mapping: `colors.*` → `--color-*`; typography roles → `--font-*`; radii → `--radius-*`; spacing → `--space-section`, `--page-max`, `--card-gap`. Global scrollbar track/thumb/hover/active colors are derived in tokens.css and used by every application-owned scroll surface.

## Do's and Don'ts

- Do keep known fees and inspection limitations close to the decision.
- Do distinguish not inspected, missing records and inspected results in text.
- Do show the demo nature of stock and images without inventing marketplace activity.
- Don't use a monthly payment as the primary car price.
- Don't hide defects, remove image details or invent service guarantees.
- Don't add decorative dashboard metrics to a shopping task.
