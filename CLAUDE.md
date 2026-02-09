# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo workspace containing multiple Flowcore-related projects, tools, and services. Each subdirectory is typically its own project with its own package.json and tooling.

## Key Directories

- `flowcore-sdk/` - Flowcore SDK
- `flowcore-cli/` - Flowcore CLI tool
- `service-*` - Backend microservices
- `platform-*-manifests/` - Kubernetes manifests for platform components
- `usable-*` - Usable.ai related projects (chat, MCP, landing page, etc.)
- `taks-*` - Taks-related projects and automations
- `speedlocal-*` - SpeedLocal projects

## API References

- **Usable API**: The OpenAPI 3.0.0 spec is stored at `docs/usable-api-openapi.json` (fetched from `https://usable.dev/api/docs`). Base URL: `https://usable.dev`. All endpoints are under `/api/...`. Auth via Bearer token.

## General Conventions

- TypeScript is the primary language across projects
- Most projects use Bun as the runtime/package manager
- Check each project's `package.json` for available scripts before running commands
- When working in a subdirectory, always `cd` into it first — each project is independent
