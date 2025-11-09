# WML Syntax Highlighting

This is a small syntax highlighting extention for the Wesnoth Markup Language (WML). It is used to create addons for Battle for Wesnoth.

> Please use the WML color theme to get the best results!

### Battle for Wesnoth 
is an [open source](https://opensource.org/faq#osd), turn-based strategy game with a high fantasy theme. It features both singleplayer and online/hotseat multiplayer combat. 

([Wesnoth Homepage](https://www.wesnoth.org/))

### How to Use/Install the version 2.0.0 with LSP support
1. Install a Java runtime (JRE), like from [here](https://adoptium.net/temurin/releases/).
2. Uninstall previous version and install the VSIX extension from this repo (available from latest CI runs, check Actions tab above).
3. Open an Addon folder with a valid `_main.cfg` via the Open Folder VSCode option. Enter Wesnoth gamedata path and userdata path in the prompt after you install it.
4. That's it. You will get success indication like this:

<img width="588" height="173" alt="Screenshot from 2025-10-04 16-28-22" src="https://github.com/user-attachments/assets/7a10375b-0471-46e2-bab5-3810327d75ef" />

### Supported LSP features:
* Go To Definition for WML macro calls.
* Hover info for WML macro calls.
* Completion for macro directives and macro calls.
* Hover info for WML paths. Show image preview if path is image.
* Completion for tag names.
* Shows help page link for tag names on hover.
* Preliminary Wesnoth path autocomplete. (Triggered by '/')
* Wesnoth Unit Type ids autocomplete. (Triggered by '=')

Note: this is still very much a prototype. Please be forgiving and report any errors you come across. A log is usually available in Output tab in VSCode under WML LSP Server category.

### Extension Preferences
<img width="841" height="402" alt="Screenshot from 2025-10-23 12-57-30" src="https://github.com/user-attachments/assets/fa0cbb93-ca71-4065-a841-cf2a42c9b80b" />

## Release Notes

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
