# 接続プロファイル管理機能

## 概要

複数のデータベース接続情報を保存・管理する機能です。接続プロファイルは `.vscode/db-connections.json` に保存され、パスワードは VS Code Secret Storage に安全に保存されます。

## 実装内容

### ConnectionProfileManager クラス

接続プロファイルの CRUD 操作を提供するクラスです。

#### 主な機能

1. **プロファイルの読み込み・保存**
   - `.vscode/db-connections.json` からの読み込み
   - ファイルへの保存

2. **CRUD 操作**
   - `getAllProfiles()` - すべてのプロファイルを取得
   - `getProfile(id)` - IDでプロファイルを取得
   - `addProfile(profile, password)` - 新規追加
   - `updateProfile(profile, password)` - 更新
   - `deleteProfile(id)` - 削除

3. **アクティブな接続の管理**
   - `getActiveProfile()` - アクティブなプロファイルを取得
   - `setActiveConnection(id)` - アクティブな接続を設定

4. **パスワード管理**
   - VS Code Secret Storage に保存
   - キー: `vsex001.db.password.{profileId}`
   - `getPassword(profileId)` - パスワード取得
   - プロファイル削除時に自動削除

## ファイル構造

```
.vscode/
├── db-connections.json         # 接続プロファイル（パスワード除く）
└── db-connections.sample.json  # サンプルファイル（リポジトリに含む）
```

## データ形式

### db-connections.json

```json
{
  "connections": [
    {
      "id": "dev-mysql",
      "name": "開発DB",
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "database": "myapp_development",
      "username": "devuser",
      "ssl": false
    }
  ],
  "activeConnectionId": "dev-mysql"
}
```

### Secret Storage

パスワードは以下のキーで保存：
```
vsex001.db.password.dev-mysql = "actual_password"
```

## セキュリティ

### パスワードの保護
- ✅ パスワードは Secret Storage に保存（暗号化）
- ✅ `db-connections.json` にはパスワードを含めない
- ✅ `.gitignore` に `db-connections.json` を追加

### .gitignore の設定

```
.vscode/db-connections.json
```

これにより、接続情報がGitリポジトリにコミットされるのを防ぎます。

## 使用例

### 初期化

```typescript
const profileManager = new ConnectionProfileManager(context);
```

### プロファイルの追加

```typescript
const profile: ConnectionProfile = {
    id: ConnectionProfileManager.generateId(),
    name: '開発DB',
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    database: 'myapp_dev',
    username: 'root',
    ssl: false
};

await profileManager.addProfile(profile, 'password123');
```

### プロファイルの取得

```typescript
// すべて取得
const profiles = profileManager.getAllProfiles();

// IDで取得
const profile = profileManager.getProfile('dev-mysql');

// アクティブなプロファイルを取得
const activeProfile = profileManager.getActiveProfile();
```

### パスワードの取得

```typescript
const password = await profileManager.getPassword('dev-mysql');
```

### プロファイルの更新

```typescript
profile.name = '開発DB (更新)';
await profileManager.updateProfile(profile);

// パスワードも更新
await profileManager.updateProfile(profile, 'new_password');
```

### プロファイルの削除

```typescript
await profileManager.deleteProfile('dev-mysql');
// パスワードも自動的に削除されます
```

### アクティブな接続の設定

```typescript
profileManager.setActiveConnection('prod-postgres');
```

## エラーハンドリング

### ワークスペースが開かれていない場合

```typescript
try {
    const profileManager = new ConnectionProfileManager(context);
} catch (error) {
    // ワークスペースが開かれていません
}
```

### ID の重複

```typescript
try {
    await profileManager.addProfile(profile, password);
} catch (error) {
    // ID "xxx" は既に使用されています
}
```

### プロファイルが見つからない場合

```typescript
try {
    await profileManager.deleteProfile('non-existent-id');
} catch (error) {
    // ID "non-existent-id" の接続プロファイルが見つかりません
}
```

## 統合

### extension.ts での初期化

```typescript
let profileManager: ConnectionProfileManager | undefined;
try {
    profileManager = new ConnectionProfileManager(context);
} catch (error) {
    console.warn('ワークスペースが開かれていません');
}
```

### DatabaseClientPanel への渡し方

```typescript
DatabaseClientPanel.createOrShow(context.extensionUri, profileManager);
```

## 今後の拡張

- [ ] プロファイルのインポート/エクスポート
- [ ] プロファイルのグループ化
- [ ] 接続テスト時の詳細情報表示
- [ ] 最近使用した接続の履歴
- [ ] プロファイルの複製機能

## 変更履歴

| 日付 | 変更内容 | 変更者 |
|------|----------|--------|
| 2025-12-28 | 初版作成 | okuyama |

