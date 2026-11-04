import java.util.Base64

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val dartDefines = providers.gradleProperty("dart-defines").orNull.orEmpty()
    .split(",")
    .filter { it.isNotEmpty() }
    .map { String(Base64.getDecoder().decode(it), Charsets.UTF_8) }
    .associate { it.substringBefore("=") to it.substringAfter("=") }
val facebookAppId = dartDefines["FACEBOOK_APP_ID"].orEmpty()
val facebookClientToken = dartDefines["FACEBOOK_CLIENT_TOKEN"].orEmpty()

android {
    namespace = "com.handigo.handigo_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.handigo.handigo_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        resValue("string", "facebook_app_id", facebookAppId)
        resValue("string", "facebook_client_token", facebookClientToken)
        resValue("string", "facebook_login_scheme", "fb$facebookAppId")
        manifestPlaceholders["facebookAutoInit"] =
            facebookAppId.isNotEmpty() && facebookClientToken.isNotEmpty()
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}
