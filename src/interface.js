#import "languages.js"
#import "streammap.js"

// Interface - Handles the user interface for the watch page
var Interface = (function() {
	var self = {
		init: init,
		update: update,
		notifyUpdate: notifyUpdate,
	};

	var groups;
	var lastStreams;

	var links = [];

	var nextId = 0;

	// createOptionsButton() - Creates the button that opens the options menu
	function createOptionsButton()
	{
		var elem = document.createElement("a"),
			optionsOpen = false;

		elem.setAttribute("href", "javascript:;");
		elem.style.position = "absolute";
		elem.style.right = elem.style.top = "8px";
		elem.innerHTML = T("button-options");

		elem.addEventListener("click", function() {
			optionsOpen = !optionsOpen;

			self.options.style.display = optionsOpen ? "" : "none";
			elem.innerHTML = optionsOpen ? T("button-options-close") : T("button-options");
		});

		return elem
	}

	// createHeader(text) - Creates a menu section header
	function createHeader(text)
	{
		var elem = document.createElement("div");

		elem.style.padding = "2px 13px";
		elem.style.fontWeight = "bold";
		elem.style.borderBottom = "1px solid #999";
		elem.style.paddingTop = "5px";

		elem.appendChild(document.createTextNode(text));

		return elem;
	}

	// createCheckbox(text) - Creates a YouTube uix checkbox
	function createCheckbox(labelText, checked, callback)
	{
		var label = document.createElement("label"),
		    span = document.createElement("span"),
		    checkbox = document.createElement("input"),
		    elem = document.createElement("span");

		span.className = "yt-uix-form-input-checkbox-container" + (checked ? "  checked" : "");
		span.style.margin = "6px 6px 6px 13px";

		checkbox.className = "yt-uix-form-input-checkbox";
		checkbox.setAttribute("type", "checkbox");
		checkbox.checked = !!checked;

		checkbox.addEventListener("change", function() {
			callback(checkbox.checked);
		}, true);

		elem.className = "yt-uix-form-input-checkbox-element";

		span.appendChild(checkbox);
		span.appendChild(elem);

		label.style.display = "block";
		label.style.paddingRight = "13px";
		label.appendChild(span);
		label.appendChild(document.createTextNode(labelText));

		return label;
	}

	function createTextBox(labelText, text, callback)
	{
		var label = document.createElement("label"),
		    container = document.createElement("div"),
		    box = document.createElement("input");

		container.style.margin = "6px 13px";

		box.className = "yt-uix-form-input-text";
		box.value = text;
		box.style.display = "block";
		box.style.boxSizing = "border-box";
		box.style.MozBoxSizing = "border-box";
		box.style.width = "100%";
		box.addEventListener("input", function() {
			callback(box.value);
		});

		label.style.display = "block";
		label.style.margin = "6px";
		label.appendChild(document.createTextNode(labelText));
		label.appendChild(document.createElement("br"));
		label.appendChild(container);
		container.appendChild(box);

		return label;
	}

	// createOptions() - Creates the options menu
	function createOptions()
	{
		var elem = document.createElement("div");

		elem.appendChild(createHeader(T("group-options")));

		// Determine whether to check GitHub for updates every two days
		elem.appendChild(createCheckbox(T("option-check"), String(localStorage["ytd-check-updates"]) == "true", function (checked) {
			localStorage["ytd-check-updates"] = checked;
		}));

		// Prefer WebM over MP4
		elem.appendChild(createCheckbox(T("option-webm"), String(localStorage["ytd-prefer-webm"]) == "true", function (checked) {
			localStorage["ytd-prefer-webm"] = checked;
			update(lastStreams);
		}));

		// Determine whether to get video file sizes (Chrome only)
		if (window.chrome)
			elem.appendChild(createCheckbox(T("option-sizes"), String(localStorage["ytd-get-sizes"]) == "true", function (checked) {
				localStorage["ytd-get-sizes"] = checked;
			}));

		// Title format
		elem.appendChild(createTextBox(T("option-format"), localStorage["ytd-title-format"], function (text) {
			localStorage["ytd-title-format"] = text;
			updateLinks();
		}));

		// Favourite itags
		elem.appendChild(createTextBox(T("option-itags"), localStorage["ytd-itags"], function (text) {
			localStorage["ytd-itags"] = text.split(",").map(Number).filter(identity).map(Math.floor).join(", ");
			update(lastStreams);
		}));

		elem.style.display = "none";

		return elem;
	}

	// createDlButton() - Creates the instant download button
	function createDlButton()
	{
		var link = document.createElement("a"),
		    elem = document.createElement("button");

		link.setAttribute("href", "javascript:;");

		elem.className = "start yt-uix-button yt-uix-button-hh-text yt-uix-tooltip";
		elem.setAttribute("title", T("download-button-tip"));
		elem.setAttribute("type", "button");
		elem.setAttribute("role", "button");
		elem.style.marginRight = "-1px";
		elem.style.borderTopRightRadius = elem.style.borderBottomRightRadius = "0px";

		elem.innerHTML = "<span class=\"yt-uix-button-content\">" + T("download-button-text") + "</span>";

		link.appendChild(elem);

		return link;
	}

	// createMenuButton() - Creates the download menu button
	function createMenuButton()
	{
		var elem = document.createElement("button");

		elem.className = "end yt-uix-button yt-uix-button-hh-text yt-uix-button-empty yt-uix-tooltip";
		elem.setAttribute("title", T("menu-button-tip"));
		elem.setAttribute("type", "button");
		elem.setAttribute("role", "button");
		elem.setAttribute("onclick", "; return false;");
		elem.style.marginRight = "0px";
		elem.style.borderTopLeftRadius = elem.style.borderBottomLeftRadius = "0px";

		elem.innerHTML = "<img class=\"yt-uix-button-arrow\" style=\"margin: 0;\" src=\"//s.ytimg.com/yt/img/pixel-vfl73.gif\" alt=\"\">";

		return elem;
	}

	// createMenu() - Creates the downloads menu
	function createMenu()
	{
		var elem = document.createElement("div");

		elem.className = "yt-uix-button-menu";
		elem.style.display = "none";
		elem.style.fontSize = "12px";
		elem.style.boxShadow = "0 3px 3px rgba(0, 0, 0, 0.1)";
		elem.style.maxHeight = "100%";
		elem.style.overflowX = "hidden";

		return elem;
	}

	function formatTitle(stream)
	{
		return (stream.vcodec ? stream.vcodec + "/" + stream.acodec : "") +
			(stream.vprofile ? " (" + stream.vprofile + (stream.level ? "@L" + stream.level.toFixed(1) : "") + ")" : "");
	}

	function updateLink(href, target)
	{
		if (!window.chrome || String(localStorage["ytd-get-sizes"]) != "true")
			return;

		var data = { "href": href, target: target };
		var event = document.createEvent("MessageEvent");
		event.initMessageEvent("ytd-update-link", true, true, JSON.stringify(data), document.location.origin, "", window);
		document.dispatchEvent(event);
	}

	// createMenuItemGroup() - Creates a sub-group for a set of related streams
	function createMenuItemGroup(streams)
	{
		// Create the button group and the size label ("360p", "480p", etc.)
		var itemGroup = document.createElement("div"),
		    size = document.createElement("div"),
		    mainLink = document.createElement("a"),
		    mainId = nextId ++;

		itemGroup.style.position = "relative";
		itemGroup.style.minWidth = streams.length * 64 + 48 + "px";

		itemGroup.addEventListener("mouseover", function() {
			itemGroup.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
		}, false);
		itemGroup.addEventListener("mouseout", function() {
			itemGroup.style.backgroundColor = "";
		}, false);

		size.className = "yt-uix-button-menu-item";
		size.style.textAlign = "right";
		size.style.width = "55px";
		size.style.position = "absolute";
		size.style.left = "0px";
		size.style.top = "0px";
		size.style.paddingLeft = size.style.paddingRight = "0px";
		size.style.paddingTop = size.style.paddingBottom = "8px";
		size.style.color = "inherit";

		// Create the main video link
		mainLink.className = "yt-uix-button-menu-item";
		mainLink.setAttribute("id", "ytd-" + mainId);
		mainLink.setAttribute("title", formatTitle(streams[0]));

		links.push({ stream: streams[0], anchor: mainLink });
		updateLink(StreamMap.getURL(streams[0]), "ytd-" + mainId);

		mainLink.style.display = "block";
		mainLink.style.paddingLeft = "55px";
		mainLink.style.marginRight = (streams.length - 1) * 64 + "px";
		mainLink.style.paddingTop = mainLink.style.paddingBottom = "8px";

		mainLink.addEventListener("contextmenu", function(e) {
			// Prevent right-click closing the menu in Chrome
			e.stopPropagation();
		}, false);

		// Append the main link to the button group
		size.appendChild(document.createTextNode(streams[0].height + "p\u00a0"));
		mainLink.appendChild(size);
		mainLink.appendChild(document.createTextNode((streams[0].stereo3d ? "3D " : "") + streams[0].container));
		itemGroup.appendChild(mainLink);

		// Create each sublink
		for (var i = 1, max = streams.length; i < max; i ++)
		{
			var subLink = document.createElement("a"),
			    subId = nextId ++;

			subLink.className = "yt-uix-button-menu-item";
			subLink.setAttribute("id", "ytd-" + subId);
			subLink.setAttribute("title", formatTitle(streams[i]));

			if (streams[i].audio)
				Audio.updateLink(streams[i], subLink);
			else
			{
				links.push({ stream: streams[i], anchor: subLink });
				updateLink(StreamMap.getURL(streams[i]), "ytd-" + subId);
			}

			subLink.style.display = "block";
			subLink.style.position = "absolute";
			subLink.style.right = (streams.length - i - 1) * 64 + "px";
			subLink.style.top = "0px";
			subLink.style.width = "53px";
			subLink.style.paddingLeft = subLink.style.paddingRight = "5px";
			subLink.style.borderLeft = "1px solid #DDD";
			subLink.style.paddingTop = subLink.style.paddingBottom = "8px";

			subLink.addEventListener("contextmenu", function(e) {
				// Prevent right-click closing the menu in Chrome
				e.stopPropagation();
			}, false);

			// Append the sublink to the button group
			subLink.appendChild(document.createTextNode(
				(streams[i].audio ? streams[i].acodec : (streams[i].stereo3d ? "3D " : "") + streams[i].container)
			));
			itemGroup.appendChild(subLink);
		}

		return itemGroup;
	}

	// createGroup(title, streams) - Creates a new menu group
	function createGroup(title, flat, streams)
	{
		var elem = document.createElement("div");

		elem.appendChild(createHeader(title));

		if (flat)
			for (var i = 0, max = streams.length; i < max; i ++)
				elem.appendChild(createMenuItemGroup([streams[i]]));
		else
		{
			var resolutions = [],
			    resGroups = {};

			for (var i = 0, max = streams.length; i < max; i ++)
			{
				if (!resGroups[streams[i].height])
				{
					resolutions.push(streams[i].height);
					resGroups[streams[i].height] = [];
				}

				resGroups[streams[i].height].push(streams[i]);
			}

			for (var i = 0, max = resolutions.length; i < max; i ++)
				elem.appendChild(createMenuItemGroup(resGroups[resolutions[i]]));
		}

		return elem;
	}

	// createUpdate() - Creates the updates button
	function createUpdate()
	{
		var elem = document.createElement("div");

		elem.appendChild(createHeader(T("group-update")));

		var a = document.createElement("a");

		a.className = "yt-uix-button-menu-item";
		a.style.paddingTop = a.style.paddingBottom = "8px";
#ifdef USO
		a.setAttribute("href", "https://userscripts.org/scripts/source/62634.user.js");
#else
		a.setAttribute("href", "https://github.com/rossy2401/youtube-video-download/raw/master/youtube-video-download.user.js");
#endif

		a.appendChild(document.createTextNode(T("button-update")));
		elem.appendChild(a);

		return elem;
	}

	// setDlButton(stream) - Sets the default stream to download
	function setDlButton(stream)
	{
		self.dlButton.getElementsByTagName("button")[0]
			.setAttribute("title", T("download-button-tip") +
			" (" + stream.height + "p " + stream.container + ")");

		links.push({ stream: stream, anchor: self.dlButton });
	}

	// updateLinks() - Set the href and download attributes of all video
	// download links
	function updateLinks()
	{
		for (var i = 0, max = links.length; i < max; i ++)
		{
			var title = formatFileName(format(localStorage["ytd-title-format"], merge(links[i].stream, VideoInfo)));

			links[i].anchor.setAttribute("download", title + StreamMap.getExtension(links[i].stream));
			links[i].anchor.setAttribute("href", StreamMap.getURL(links[i].stream, title));
		}
	}

	// update(streams) - Adds streams to the menu
	function update(streams)
	{
		lastStreams = streams;
		streams = streams
			.filter(function(obj) { return obj.url; })
			.sort(StreamMap.sortFunc);
		links = [];

		var favouriteItags = localStorage["ytd-itags"].split(",").map(Number);
		var favouriteStreams =
			streams
				.filter(function(obj) {
					return (obj.favouriteIndex = favouriteItags.indexOf(Number(obj.itag))) + 1;
				})
				.sort(function(a, b) { return a.favouriteIndex - b.favouriteIndex; });

		if (favouriteStreams.length)
			setDlButton(favouriteStreams[0]);
		else if (streams.length)
			setDlButton(streams[0]);
		else
		{
			var button = self.dlButton.getElementsByTagName("button")[0];

			self.menuButton.disabled = true;
			self.menuButton.setAttribute("title", "");

			button.setAttribute("title", T("error-no-downloads"));
		}

		self.downloads.innerHTML = "";

		for (var i = 0, max = groups.length; i < max; i ++)
		{
			var groupStreams = streams.filter(groups[i].predicate);

			if (groupStreams.length)
				self.downloads.appendChild(createGroup(groups[i].title, groups[i].flat, groupStreams));
		}

		updateLinks();
	}

	// init() - Initalises the user interface
	function init()
	{
		// Get the flag button from the actions menu
		var buttonGroup = document.createElement("span"),
		    watchSentimentActions = document.getElementById("watch7-sentiment-actions"),
		    watchLike = document.getElementById("watch-like"),
		    watchDislike = document.getElementById("watch-dislike");

		groups = [
			{ title: T("group-high-definition"), predicate: function(stream) {
				return stream.height && stream.container && stream.container != "3GPP" && stream.height > 576;
			} },
			{ title: T("group-standard-definition"), predicate: function(stream) {
				return stream.height && stream.container && stream.container != "3GPP" && stream.height <= 576;
			} },
			{ title: T("group-mobile"), predicate: function(stream) {
				return stream.height && stream.container && stream.container == "3GPP";
			} },
			{ title: T("group-unknown"), flat: true, predicate: function(stream) {
				return !stream.height || !stream.container;
			} },
		];

		buttonGroup.className = "yt-uix-button-group";

		// Create the buttons
		self.dlButton = createDlButton();
		self.menuButton = createMenuButton();

		// Create the dropdown menu
		self.menu = createMenu();
		self.menu.appendChild(createOptionsButton());
		self.menu.appendChild(self.options = createOptions());
		self.menu.appendChild(self.downloads = document.createElement("div"));
		self.menuButton.appendChild(self.menu);

		// Populate the button group
		buttonGroup.appendChild(self.dlButton);
		buttonGroup.appendChild(self.menuButton);

		if (watchLike)
		{
			// If the like button is disabled, all the controls should be
			// disabled
			self.dlButton.disabled = self.menuButton.disabled = watchLike.disabled;

			// Add a space between the Like and Dislike buttons to make them
			// consistent with the download button in Chrome
			watchDislike.parentNode.insertBefore(document.createTextNode(" "), watchDislike);
		}

		watchSentimentActions.appendChild(buttonGroup);

		if (watchLike && watchDislike)
			// Reduce the margin between the Like and Dislike buttons, so the
			// download button can fit
			watchLike.style.marginRight = watchDislike.style.marginRight = "2px";
	}

	function notifyUpdate()
	{
		self.menu.appendChild(createUpdate());
	}

	return self;
})();
