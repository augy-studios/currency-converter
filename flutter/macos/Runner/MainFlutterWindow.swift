import Cocoa
import FlutterMacOS
import desktop_multi_window

class MainFlutterWindow: NSWindow {
  /// The macOS Tahoe look's glass (lib/theme/theme.dart): the desktop behind the window, blurred
  /// by the system, under the app's see-through page. Nil in the other look.
  private var glass: NSVisualEffectView?

  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)

    RegisterGeneratedPlugins(registry: flutterViewController)
    // Each desktop widget is a window with an engine of its own: it gets the same plugins.
    FlutterMultiWindowPlugin.setOnWindowCreatedCallback { controller in
      RegisterGeneratedPlugins(registry: controller)
    }
    (NSApp.delegate as? AppDelegate)?.attach(flutterViewController.engine.binaryMessenger, window: self)

    super.awakeFromNib()
  }

  /// Puts the glass behind the app, or takes it away. Says whether it's there.
  func setGlass(on: Bool, dark: Bool) -> Bool {
    guard let controller = contentViewController as? FlutterViewController,
          let content = contentView,
          let frameView = content.superview else { return false }
    if on {
      let effect = glass ?? NSVisualEffectView()
      effect.blendingMode = .behindWindow
      effect.material = .underWindowBackground
      effect.state = .active
      effect.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
      effect.frame = content.frame
      effect.autoresizingMask = [.width, .height]
      if glass == nil {
        frameView.addSubview(effect, positioned: .below, relativeTo: content)
        glass = effect
      }
      isOpaque = false
      backgroundColor = .clear
      controller.backgroundColor = .clear
      return true
    }
    glass?.removeFromSuperview()
    glass = nil
    isOpaque = true
    backgroundColor = .windowBackgroundColor
    controller.backgroundColor = nil
    return false
  }
}
