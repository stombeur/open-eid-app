#call from other app using URL
on open location URL
	start_app(|URL|)
end open location

#call from command line
on run argv
	start_app(argv)
end run

on start_app(args)
	if args is equal to "current application" then set args to ""
	if args contains "?" then
		#ok
	else
		set args to args & "?"
	end if
	#application path
	set launch_path to (POSIX path of (path to me as Unicode text))
	#caller path
	set front_app to (POSIX path of (path to frontmost application as Unicode text))
	set front_id to bundle identifier of (info for (path to frontmost application))
	set args to args & "&eid-app=" & front_app & "&eid-bundle=" & front_id
	#hide script icon
	do shell script "/usr/libexec/PlistBuddy -c 'Delete :LSUIElement' \"" & launch_path & "Contents/Info.plist\""
	#start app
	do shell script "\"" & launch_path & "Contents/MacOS/open-eid\" \"" & args & "\""
	#show script icon
	do shell script "/usr/libexec/PlistBuddy -c 'Add :LSUIElement bool true' \"" & launch_path & "Contents/Info.plist\""
	quit
end start_app