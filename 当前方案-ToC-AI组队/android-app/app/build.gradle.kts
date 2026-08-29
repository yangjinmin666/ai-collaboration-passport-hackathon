import java.net.URI

plugins {
    id("com.android.application")
}

val generatedWebAssets = layout.buildDirectory.dir("generated/rallyWebAssets")
val rallyAssetHost = "rally.local"
val rallyApiOrigin = providers.gradleProperty("rallyApiOrigin")
    .orElse("https://49.233.197.225")
    .get()
    .removeSuffix("/")
val rallyApiUri = URI(rallyApiOrigin)

require(
    rallyApiUri.scheme == "https"
        && rallyApiUri.host != null
        && rallyApiUri.rawUserInfo == null
        && rallyApiUri.rawQuery == null
        && rallyApiUri.rawFragment == null
        && (rallyApiUri.path.isNullOrEmpty() || rallyApiUri.path == "/")
) {
    "rallyApiOrigin must be an HTTPS origin without credentials, path, query, or fragment"
}

val syncWebAssets by tasks.registering(Sync::class) {
    description = "Copies the current Rally mobile prototype into the APK."
    group = "build"
    inputs.property("rallyApiOrigin", rallyApiOrigin)
    from("../../prototype/mobile-demo") {
        include(
            "index.html",
            "styles.css",
            "app.js",
            "api-client.js",
            "manifest.webmanifest",
            "offline.html",
            "sw.js",
            "assets/**",
        )
        filesMatching("index.html") {
            filter { line ->
                line.replace(
                    "if (\"serviceWorker\" in navigator) {",
                    "if (\"serviceWorker\" in navigator && location.hostname !== \"$rallyAssetHost\") {",
                ).replace(
                    "<meta name=\"rally-api-origin\" content=\"\" />",
                    "<meta name=\"rally-api-origin\" content=\"$rallyApiOrigin\" />",
                )
            }
        }
    }
    into(generatedWebAssets.map { it.dir("www") })
}

android {
    namespace = "ai.rally.collaboration"
    compileSdk = 36

    defaultConfig {
        applicationId = "ai.rally.collaboration"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "RALLY_ASSET_HOST", "\"$rallyAssetHost\"")
    }

    sourceSets.getByName("main").assets.srcDir(generatedWebAssets)

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}

tasks.named("preBuild").configure {
    dependsOn(syncWebAssets)
}
