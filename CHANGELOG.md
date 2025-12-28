# Changelog

All notable changes to the "QueryCanvas" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Conditional Column Styling** 🆕: Dynamic cell styling based on values
  - Support for type specification (`type=int`, `type=float`, `type=decimal`, `type=text`)
  - Conditional operators: `<`, `>`, `<=`, `>=`, `==`, `!=`
  - Dynamic styling: `color`, `backgroundColor`, `bold`, `fontWeight`
  - Multiple conditions per column with priority ordering
  - Examples:
    - `if<0:color=red` - Display negative values in red
    - `if>1000:bold=true` - Bold values over 1000
    - `if<=0:color=#999999 if>=10000:color=#ff0000,bold=true` - Multiple conditions
- Comprehensive documentation for conditional styling feature
- 8 practical SQL examples in `docs/examples/conditional-styling-examples.sql`
- Testing guide for conditional styling (`docs/TESTING-CONDITIONAL-STYLING.md`)

### Changed
- Updated `.cursorrules` with conditional styling syntax for Cursor AI integration
- Enhanced `README.md` with conditional styling feature description

## [0.1.1] - 2025-12-28

### Added
- Initial marketplace release
- Multi-connection support for MySQL and PostgreSQL
- SQL display options via comments (`@column` directives)
  - Text alignment (`align`)
  - Number formatting (`format=number`, `comma`, `decimal`)
  - Datetime formatting (`format=datetime`, `pattern`)
  - Column styling (`width`, `color`, `backgroundColor`, `bold`)
- Schema auto-documentation in Markdown format
- Query result saving (TSV/JSON with metadata)
- Session persistence and file watching
- Saved query library with caching
- Multilingual support (English/Japanese)
- Read-only mode (security feature)
- SQL formatter integration
- Cursor AI integration via session file editing

### Security
- Only SELECT, SHOW, DESC, EXPLAIN queries allowed
- INSERT, UPDATE, DELETE, ALTER, TRUNCATE are blocked
- Passwords stored in VS Code Secret Storage
- SSL connection support

## [0.1.0] - 2025-12-27

### Added
- Initial development version
- Basic database connection layer
- Webview panel implementation
- Connection profile management

---

## Future Plans

### Planned Features
- [ ] Query history tracking
- [ ] SQL auto-completion (table/column names)
- [ ] ER diagram generation
- [ ] Dataset diff viewer
- [ ] Performance analysis tools (EXPLAIN visualization)
- [ ] String-based conditional styling (contains, startsWith, endsWith)
- [ ] Regular expression pattern matching
- [ ] Custom format presets
- [ ] GUI-based display option editor

### Under Consideration
- [ ] Query result pagination for large datasets
- [ ] Virtual scrolling for performance
- [ ] Connection pooling
- [ ] Dark mode enhancements
- [ ] Keyboard shortcuts customization
- [ ] Drag & drop table addition

---

## Upgrade Guide

### From 0.1.1 to Unreleased (Conditional Styling)

No breaking changes. The new conditional styling feature is fully backward compatible.

**To use the new feature:**

1. Update your SQL queries with type specifications:
   ```sql
   /**
    * @column amount type=int align=right format=number comma=true
    */
   SELECT amount FROM orders;
   ```

2. Add conditional styling rules:
   ```sql
   /**
    * @column amount type=int if<0:color=red if>1000:bold=true
    */
   SELECT amount FROM orders;
   ```

**Migration Notes:**
- Existing queries without `type` specification will continue to work
- Conditional styling only applies when explicitly defined
- No configuration changes required

---

## Contributing

We welcome contributions! Please see our [GitHub repository](https://github.com/okuyamashin/querycanvas) for details.

## Support

If you encounter any issues or have feature requests, please file them at our [GitHub Issues](https://github.com/okuyamashin/querycanvas/issues).

