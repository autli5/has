import java.io.File
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import javax.inject.Inject
import org.gradle.process.ExecOperations

abstract class BuildTask : DefaultTask() {
    @get:Inject
    abstract val execOperations: ExecOperations

    @Input
    var rootDirRel: String? = null
    @Input
    var projectDir: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        val candidates = listOf(
            "/usr/local/bin/npm",
            "/opt/homebrew/bin/npm",
            System.getProperty("user.home") + "/.nvm/versions/node/$(node -v)/bin/npm",
            "npm"
        )
        val executable = candidates.firstOrNull { File(it).exists() } ?: "npm"
        try {
            runTauriCli(executable)
        } catch (e: Exception) {
            if (Os.isFamily(Os.FAMILY_WINDOWS)) {
                // Try different Windows-specific extensions
                val fallbacks = listOf(
                    "$executable.exe",
                    "$executable.cmd",
                    "$executable.bat",
                )

                var lastException: Exception = e
                for (fallback in fallbacks) {
                    try {
                        runTauriCli(fallback)
                        return
                    } catch (fallbackException: Exception) {
                        lastException = fallbackException
                    }
                }
                throw lastException
            } else {
                throw e;
            }
        }
    }

    fun runTauriCli(executable: String) {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")
        val args = listOf("run", "--", "tauri", "android", "android-studio-script");

        val userHome = System.getProperty("user.home")
        val androidSdk = File(userHome, "Library/Android/sdk")
        val ndkDir = File(androidSdk, "ndk/27.2.12479018")
        val toolchainBin = File(ndkDir, "toolchains/llvm/prebuilt/darwin-x86_64/bin")

        execOperations.exec {
            workingDir(File(projectDir, rootDirRel))
            executable(executable)
            args(args)
            if (androidSdk.exists()) {
                environment("ANDROID_HOME", androidSdk.absolutePath)
            }
            if (ndkDir.exists()) {
                environment("NDK_HOME", ndkDir.absolutePath)
            }
            val existingPath = System.getenv("PATH") ?: "/usr/bin:/bin:/usr/sbin:/sbin"
            val fullPath = "${toolchainBin.absolutePath}:/usr/local/bin:/opt/homebrew/bin:$existingPath"
            environment("PATH", fullPath)
            environment("OPENSSL_STATIC", "1")
            environment("AR_aarch64_linux_android", "llvm-ar")
            environment("RANLIB_aarch64_linux_android", "llvm-ranlib")
            environment("RUSTFLAGS", "-C link-arg=-Wl,-z,max-page-size=16384")
            if (logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            if (release) {
                args("--release")
            }
            args(listOf("--target", target))
        }.assertNormalExitValue()
    }
}