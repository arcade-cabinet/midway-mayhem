// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.3.1"),
        .package(name: "CapacitorCommunitySqlite", path: "../../../node_modules/.pnpm/@capacitor-community+sqlite@8.1.0_@capacitor+core@8.3.1/node_modules/@capacitor-community/sqlite"),
        .package(name: "CapacitorApp", path: "../../../node_modules/.pnpm/@capacitor+app@8.1.0_@capacitor+core@8.3.1/node_modules/@capacitor/app"),
        .package(name: "CapacitorDevice", path: "../../../node_modules/.pnpm/@capacitor+device@8.0.2_@capacitor+core@8.3.1/node_modules/@capacitor/device"),
        .package(name: "CapacitorHaptics", path: "../../../node_modules/.pnpm/@capacitor+haptics@8.0.2_@capacitor+core@8.3.1/node_modules/@capacitor/haptics"),
        .package(name: "CapacitorPreferences", path: "../../../node_modules/.pnpm/@capacitor+preferences@8.0.1_@capacitor+core@8.3.1/node_modules/@capacitor/preferences"),
        .package(name: "CapacitorScreenOrientation", path: "../../../node_modules/.pnpm/@capacitor+screen-orientation@8.0.1_@capacitor+core@8.3.1/node_modules/@capacitor/screen-orientation"),
        .package(name: "SentryCapacitor", path: "../../../node_modules/.pnpm/@sentry+capacitor@3.2.1_@capacitor+core@8.3.1_@sentry+react@10.49.0_react@19.2.5_/node_modules/@sentry/capacitor")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunitySqlite", package: "CapacitorCommunitySqlite"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorDevice", package: "CapacitorDevice"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorScreenOrientation", package: "CapacitorScreenOrientation"),
                .product(name: "SentryCapacitor", package: "SentryCapacitor")
            ]
        )
    ]
)
