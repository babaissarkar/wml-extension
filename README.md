# WML Syntax Highlighting and LSP

This is a syntax highlighting and intellisense/LSP (partial) extention for the Wesnoth Markup Language (WML). It is used to create addons for Battle for Wesnoth.

> Please use the WML color theme to get the best results!

### Battle for Wesnoth 
is an [open source](https://opensource.org/faq#osd), turn-based strategy game with a high fantasy theme. It features both singleplayer and online/hotseat multiplayer combat. 

([Wesnoth Homepage](https://www.wesnoth.org/))

### How to Use/Install the version 2.0.0 with LSP support
1. Uninstall previous version and install the latest VSIX extension from this repo (available from latest CI runs, check Actions tab above).
2. Open an Addon folder with a valid `_main.cfg` via the Open Folder VSCode option. Enter Wesnoth gamedata path and userdata path in the prompt after you install it.
3. Enter the Wesnoth data/userdata path and any custom defines in the prompt. (Can be added later via setting, but datapath/userdatapath is required for the LSP to work.)
4. That's it. You will get success indication like this:

<img width="588" height="173" alt="Screenshot from 2025-10-04 16-28-22" src="https://github.com/user-attachments/assets/7a10375b-0471-46e2-bab5-3810327d75ef" />

### Supported LSP features:
* Hover, Go To Definition and References for WML macro calls.
* Hover and Go To Definition for Unit Types.
* Completion for macro directive, macro calls and Unit Types.
* Hover info for WML paths including AnimationWML. Show image preview if path is image.
* Completion for tag names. Shows help page link for tag names on hover.
* Preliminary Wesnoth path autocomplete. (Triggered by '/')
* Inlay Hints for position macro call arguments.
* Symbol table for macro definitions.

Note: this is still very much a prototype. Please be forgiving and report any errors you come across. A log is usually available in Output tab in VSCode under WML LSP Server category.

### Extension Preferences

| Setting | Default | Description |
|---|---|---|
| `wml.javaPath` | *(system java)* | Path to the `java` executable. Leave blank to use the system `PATH`. Must not contain spaces. |
| `wml.exePath` | *(none)* | Custom launch command for the WML language server. Overrides `wml.javaPath` when set. See below. |
| `wml.dataDir` | *(none)* | Path to Wesnoth's `data` directory (contains `core/`, `campaigns/`, etc.). |
| `wml.userDataDir` | *(none)* | Path to Wesnoth's userdata directory. Typically `~/.local/share/wesnoth/<version>/` on Linux. |
| `wml.defines` | *(none)* | Comma-separated preprocessor defines passed to the WML parser. |

#### `wml.javaPath`

If `java` is not on your system `PATH`, set this to the full path of your `java` executable.
```json
"wml.javaPath": "/opt/jdk-21/bin/java"
```

> [!WARNING]
> Must not contain spaces.

#### `wml.exePath`

For advanced use. Overrides the default server launch entirely — use this to run a custom Java runtime or a native server executable. When this is set, `wml.javaPath` is ignored and no Java check is performed on startup.

The value is split on whitespace, so you can include arguments:
```json
"wml.exePath": "/opt/myjava/bin/java -jar /opt/mywml/wml.jar"
```
> [!WARNING]
> Individual path components must not contain spaces.

#### `wml.defines`

Pass preprocessor defines to simulate specific build conditions, such as being inside a particular campaign or difficulty level. Comma-separated, `KEY=VALUE` format.
```json
"wml.defines": "CAMPAIGN_MY_CAMPAIGN=true,DIFFICULTY_HARD=true"
```

#### Known Limitations

- Paths containing spaces are not supported in `wml.javaPath` or `wml.exePath`.

## Release Notes

### Version 3.0.0
+ Rewritten LSP support in conjunction with [my LSP4j based LSP server here](https://github.com/babaissarkar/wml-multitool).
+ Hover/Go To Definition support for Unit Types. Completion improved.
+ References support for Macros
+ Userdata (if inside add-ons directory) and Defines autodetection. (MULTIPLAYER, difficulty macros, Campaign defines)

### Version 2.0.0
LSP support in conjunction with [my LSP4j based LSP server here](https://github.com/babaissarkar/wml-parser-lsp).

### Version 1.0.6

+ fixed typo in name :blushing:
+ added \\# po:

### Version 1.0.5

+ added \#ifhave
+ added \#ifnhave

### Version 1.0.4

+ better auto indentation


### Version 1.0.3

+ added automatic indent after opening tags and automatic deindent of closing tags

### Version 1.0.2

+ fixed comments without a blank between \# and text not recognized 

### Version 1.0.1

+ added \#arg
+ added \#ifnver
+ added \#warning
+ added \#error
+ added \# wmllint:
+ added \# wmlindent:
+ added \# wmlscope:
+ numerics and booleans are bold

### Version 1.0.0

Initial release of WMl Syntax Highlighting Support
