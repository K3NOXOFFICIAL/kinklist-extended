var log = function(val, base) {
    return Math.log(val) / Math.log(base);
};
var strToClass = function(str){
    var className = "";
    str = str.toLowerCase();
    var validChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var newWord = false;
    for(var i = 0; i < str.length; i++) {
        var chr = str[i];
        if(validChars.indexOf(chr) >= 0) {
            if(newWord) chr = chr.toUpperCase();
            className += chr;
            newWord = false;
        }
        else {
            newWord = true;
        }
    }
    return className;
};
var addCssRule = function(selector, rules){
    var sheet = document.styleSheets[0];
    if("insertRule" in sheet) {
        sheet.insertRule(selector + "{" + rules + "}", 0);
    }
    else if("addRule" in sheet) {
        sheet.addRule(selector, rules, 0);
    }
};

var kinks = {};
var inputKinks = {}
var colors = {}
var level = {};
let kinkSizes = {
    "209": "light",
    "285": "detailed",
    "589": "extreme",
    "216": "light",
    "288": "detailed",
    "576": "extreme",
    "432": "classic",
};

var allowHashUpdate = true;
var isHashUpdating = false;
var scrollTimeout = null;
var lastScrollTime = 0;
var parseHashTimeout = null;
function runAfterScrollSettled(fn, delay) {
    delay = delay || 200;
    if (window.isScrolling || ((new Date()).getTime() - lastScrollTime < 1000)) {
        setTimeout(function(){ runAfterScrollSettled(fn, delay); }, delay);
    }
    else {
        try { fn(); } catch(e) { console.error('runAfterScrollSettled error', e); }
    }
}
// Use history.replaceState to update the hash without triggering navigation/scroll
function setHashWithoutScroll(hash){
    try {
        if(window && window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#' + hash);
        }
        else {
            location.hash = hash;
        }
    }
    catch(e) {
        try { location.hash = hash; } catch(e2) {}
    }
}

function LoadList() {
    fileToRead = $("#listType").val() + '.txt';
    return $.get(fileToRead, function(data) {
        $('#Kinks').text(data);
        var selection = inputKinks.saveSelection();
        var kinksText = $('#Kinks').val();
        kinks = inputKinks.parseKinksText(kinksText);
        inputKinks.fillInputList();
    }, 'text');
}

// Debounce function
function debounce(func, wait, immediate) {
    let timeout;
    return function() {
        const context = this,
              args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// Debounced version of updateHash with a 300ms delay
const debouncedUpdateHash = debounce(function() {
    if (!isHashUpdating) {
        isHashUpdating = true;
        setHashWithoutScroll(inputKinks.updateHash());
        setTimeout(function() {
            isHashUpdating = false;
        }, 100);
    }
}, 300);



$(function(){

    var imgurClientId = '9db53e5936cd02f';

    // Force loading the default item
    runAfterScrollSettled(function(){ LoadList(); }, 0);

    $("#listType").change(LoadList);
    
    inputKinks = {
        $columns: [],
            // exportScale controls how many physical pixels per CSS pixel the exported canvas will use.
            // Set to 1 to keep original behaviour (no extra density). Set to 2 or higher for HiDPI
            // exports. You can override this at runtime with `window.kinklistExportScale`.
            exportScale: (typeof window !== 'undefined' && typeof window.kinklistExportScale === 'number') ? window.kinklistExportScale : 2,
        selectionState: {},
        createCategory: function(name, fields){
            var $category = $('<div class="kinkCategory">')
                    .addClass('cat-' + strToClass(name))
                    .data('category', name)
                    .append($('<h2>')
                    .text(name));

            var $table = $('<table class="kinkGroup">').data('fields', fields);
            var $thead = $('<thead>').appendTo($table);
            for(var i = 0; i < fields.length; i++) {
                $('<th>').addClass('choicesCol').text(fields[i]).appendTo($thead);
            }
            $('<th>').appendTo($thead);
            $('<tbody>').appendTo($table);
            $category.append($table);

            return $category;
        },
        createChoice: function(){
            var $container = $('<div>').addClass('choices');
            var levels = Object.keys(level);
            for(var i = 0; i < levels.length; i++) {
                $('<button>')
                        .addClass('choice')
                        .addClass(level[levels[i]])
                        .data('level', levels[i])
                        .data('levelInt', i)
                        .attr('title', levels[i])
                        .appendTo($container)
                        .on('click', function(){
                            $container.find('button').removeClass('selected');
                            $(this).addClass('selected');
                            // Update selection state map based on category/kink/field
                            var $choices = $(this).closest('.choices');
                            var $kinkRow = $choices.closest('tr.kinkRow');
                            var $cat = $choices.closest('.kinkCategory');
                            if($kinkRow.length && $cat.length) {
                                var category = $cat.data('category');
                                var kink = $kinkRow.data('kink');
                                var field = $choices.data('field');
                                var levelInt = $(this).data('levelInt');
                                var key = strToClass(category) + '|' + strToClass(kink) + '|' + strToClass(field);
                                inputKinks.selectionState[key] = levelInt;
                            }
                        });
            }
            return $container;
        },
        createKink: function(fields, kink){
            var $row = $('<tr>').data('kink', kink.kinkName).addClass('kinkRow');
            for(var i = 0; i < fields.length; i++) {
                var $choices = inputKinks.createChoice();
                $choices.data('field', fields[i]);
                $choices.addClass('choice-' + strToClass(fields[i]));
                $('<td>').append($choices).appendTo($row);
            }
            var kinkLabel = $('<td>').text(kink.kinkName).appendTo($row);
            if(kink.kinkDesc) {showDescriptionButton(kink.kinkDesc, kinkLabel);}
            $row.addClass('kink-' + strToClass(kink.kinkName));
            return $row;
        },
        createColumns: function(){
            var colClasses = ['100', '50', '33', '25'];

            var numCols = Math.floor((document.body.scrollWidth - 20) / 400);
            if(!numCols) numCols = 1;
            if(numCols > 4) numCols = 4;
            var colClass = 'col' + colClasses[numCols - 1];

            inputKinks.$columns = [];
            for(var i = 0; i < numCols; i++){
                inputKinks.$columns.push($('<div>').addClass('col ' + colClass).appendTo($('#InputList')));
            }
        },
        placeCategories: function($categories){
            var $body = $('body');
            var totalHeight = 0;
            for(var i = 0; i < $categories.length; i++) {
                var $clone = $categories[i].clone().appendTo($body);
                var height = $clone.height();;
                totalHeight += height;
                $clone.remove();
            }

            var colHeight = totalHeight / (inputKinks.$columns.length);
            var colIndex = 0;
            for(var i = 0; i < $categories.length; i++) {
                var curHeight = inputKinks.$columns[colIndex].height();
                var catHeight = $categories[i].height();
                if(curHeight + (catHeight / 2) > colHeight) colIndex++;
                while(colIndex >= inputKinks.$columns.length) {
                    colIndex--;
                }
                inputKinks.$columns[colIndex].append($categories[i]);
            }
        },
        fillInputList: function(){
            // Save current selections so they are not lost when rebuilding the DOM
            var savedSelection = inputKinks.saveSelectionKeys();
            // Preserve current scroll position so DOM updates don't jump the user
            var prevScrollTop = (window && (window.pageYOffset || document.documentElement.scrollTop)) || 0;
            // Hide the input list visually to avoid flicker during rebuild (but keep layout using opacity)
            $('#InputList').css('opacity', 0);
            $('#InputList').empty();
            inputKinks.createColumns();

            var $categories = [];
            var kinkCats = Object.keys(kinks);
            for(var i = 0; i < kinkCats.length; i++) {
                var catName = kinkCats[i];
                var category = kinks[catName];
                var fields = category.fields;
                var kinkArr = category.kinks;

                var $category = inputKinks.createCategory(catName, fields);
                var $tbody = $category.find('tbody');
                for(var k = 0; k < kinkArr.length; k++) {
                    $tbody.append(inputKinks.createKink(fields, kinkArr[k]));
                }

                $categories.push($category);
            }
            inputKinks.placeCategories($categories);

            // Restore the selections we saved earlier without updating the hash
            if(savedSelection && savedSelection.length) {
                inputKinks.restoreSavedSelectionFromKeys(savedSelection, false);
            }
            // Restore scroll position and un-hide InputList
            setTimeout(function(){
                if(typeof window.scrollTo === 'function' && !(window.navigator && window.navigator.userAgent && window.navigator.userAgent.indexOf('jsdom') !== -1)) {
                    window.scrollTo(0, prevScrollTop);
                }
                $('#InputList').css('opacity', 1);
            }, 0);

            // Make things update hash
            $('#InputList').find('button.choice').on('click', function(){
                if (allowHashUpdate && !isHashUpdating) {
                    //location.hash = inputKinks.updateHash();
                    debouncedUpdateHash();
                }
            });
        },
        init: function(){
            // Set up DOM
            inputKinks.fillInputList();
            inputKinks.updateSelectionStateFromDOM();

            // Read hash
            inputKinks.parseHash();

            // Make export button work
            $('#Export').on('click', inputKinks.export);
            $('#URL').on('click', function(){ this.select(); });

            // On resize, redo columns
            (function(){

                var lastResize = 0;
                var lastBodyWidth = (document.body && document.body.scrollWidth) ? document.body.scrollWidth : 0;
                $(window).on('resize', function(){
                    var curTime = (new Date()).getTime();
                    lastResize = curTime;
                    setTimeout(function(){
                        if(lastResize === curTime) {
                            // If width hasn't changed, it's likely just the browser chrome hide/show; skip layout rebuilds
                            var currentWidth = (document.body && document.body.scrollWidth) ? document.body.scrollWidth : 0;
                            if (currentWidth === lastBodyWidth) {
                                return;
                            }
                            lastBodyWidth = currentWidth;
                            // If we have very recently scrolled, wait a bit longer before rebuilding
                            var timeSinceScroll = (new Date()).getTime() - lastScrollTime;
                            if (timeSinceScroll < 1000 || window.isScrolling) {
                                // Defer until after scrolling settles
                                setTimeout(function(){
                                    runAfterScrollSettled(function(){ inputKinks.fillInputList(); }, 0);
                                }, 1000);
                            }
                            else {
                                runAfterScrollSettled(function(){ inputKinks.fillInputList(); }, 0);
                            }
                        }
                    }, 500);
                });

            })();
        },
        hashChars: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.=+*^!@",
        //hashChars: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.=+*^!@",
        hashChars: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        maxPow: function(base, maxVal) {
            var maxPow = 1;
            for(var pow = 1; Math.pow(base, pow) <= maxVal; pow++){
                maxPow = pow;
            }
            return maxPow;
        },
        prefix: function(input, len, char){
            while(input.length < len) {
                input = char + input;
            }
            return input;
        },
        drawLegend: function(context){
            // Adjust font size based on available CSS width so long labels have more room
            var fontSize = 13;
            if (cssWidth <= 500) fontSize = 11;
            else if (cssWidth <= 900) fontSize = 12;
            context.font = 'bold ' + fontSize + 'px Arial';
            context.fillStyle = '#e6e6e6';

            var levels = Object.keys(colors);
            // compute CSS width by dividing physical px width by scale
            var scale = 1;
            var cssWidth = 0;
            try {
                if (context && context.canvas) {
                    if (typeof $(context.canvas).width === 'function') {
                        cssWidth = $(context.canvas).width() || 0;
                    }
                    if (!cssWidth) {
                        // fallback to divide canvas physical width by export scale
                        scale = (typeof inputKinks.exportScale === 'number') ? Math.max(1, Math.floor(inputKinks.exportScale)) : 1;
                        cssWidth = Math.round(context.canvas.width / scale);
                    } else {
                        scale = context.canvas.width / cssWidth;
                        if (!isFinite(scale) || scale <= 0) {
                            scale = (typeof inputKinks.exportScale === 'number') ? Math.max(1, Math.floor(inputKinks.exportScale)) : 1;
                            cssWidth = Math.round(context.canvas.width / scale);
                        }
                    }
                }
            } catch(e) { cssWidth = (context && context.canvas) ? context.canvas.width : 0; scale = 1; }

            // Layout variables
            var circleRadius = 8;
            var circleDiameter = circleRadius * 2;
            var gapBetweenCircleAndText = 8;
            var interItemSpacing = 30; // spacing between items (increased to reduce collisions)
            var rightPadding = 22;
            var topPadding = 17; // center Y for first row
            var lineHeight = 26; // distance between rows

            // Build items with widths
            var items = [];
            var totalWidth = 0;
            for(var i = 0; i < levels.length; i++){
                var text = levels[i];
                var textWidth = context.measureText(text).width || 0;
                // Fallback if measureText failed (e.g., missing font in headless environments)
                if (!textWidth || textWidth < 1) textWidth = text.length * 8;
                var minItemWidth = 80; // ensure items aren't too narrow - prevents overlap when measurement is odd
                var itemWidth = Math.max(minItemWidth, circleDiameter + gapBetweenCircleAndText + textWidth + interItemSpacing);
                items.push({ text: text, width: itemWidth, textWidth: textWidth, color: colors[text] });
                totalWidth += itemWidth;
            }

            // Wrap into lines if necessary
            var lines = [];
            var curLine = { items: [], width: 0 };
            var maxLineWidth = cssWidth - (rightPadding * 2) - 20; // leave some left padding to avoid clipping
            for(var i = 0; i < items.length; i++){
                var it = items[i];
                if(curLine.items.length === 0 || curLine.width + it.width <= maxLineWidth) {
                    curLine.items.push(it);
                    curLine.width += it.width;
                }
                else {
                    lines.push(curLine);
                    curLine = { items: [it], width: it.width };
                }
            }
            if(curLine.items.length) lines.push(curLine);

            // Draw each line, right aligned
            for(var ln = 0; ln < lines.length; ln++){
                var line = lines[ln];
                var xStart = cssWidth - rightPadding - line.width;
                var baseY = topPadding + (ln * lineHeight);
                var curX = xStart;
                for(var k = 0; k < line.items.length; k++){
                    var item = line.items[k];
                    // Circle
                    context.beginPath();
                    context.arc(curX + circleRadius, baseY, circleRadius, 0, 2 * Math.PI, false);
                    context.fillStyle = item.color;
                    context.fill();
                    context.strokeStyle = 'rgba(255, 255, 255, 0.06)'
                    context.lineWidth = 1;
                    context.stroke();

                    // Text
                    context.fillStyle = '#e6e6e6';
                    context.fillText(item.text, curX + circleDiameter + gapBetweenCircleAndText, baseY + 5);

                    curX += item.width;
                }
            }
            try {
                // Debugging: print legend layout in the console when exporting an image
                if(typeof window !== 'undefined' && window && window.console && window.location && window.location.href.indexOf('#') !== -1) {
                    // Only print when running in browser (not in tests) and when hash exists
                    console.log('drawLegend lines', lines);
                }
            }
            catch(e) {}
        },
            setupCanvas: function(width, height, username){
                // Determine target scale for exported canvas
                var scale = 1;
                if (typeof window !== 'undefined' && typeof window.kinklistExportScale === 'number') {
                    scale = Math.max(1, Math.floor(window.kinklistExportScale));
                }
                else if (typeof inputKinks.exportScale === 'number') {
                    scale = Math.max(1, Math.floor(inputKinks.exportScale));
                }

                $('canvas').remove();
                var canvas = document.createElement('canvas');
                // Use physical pixel size for canvas width/height, but preserve CSS size
                canvas.width = Math.ceil(width * scale);
                canvas.height = Math.ceil(height * scale);

                var $canvas = $(canvas);
                $canvas.css({
                    width: width + 'px',
                    height: height + 'px'
                });

                var context = canvas.getContext('2d');
                // scale drawing operations so code can use CSS pixels
                context.scale(scale, scale);

                var bgColor = (typeof window !== 'undefined' && typeof window.kinklistExportBg === 'string') ? window.kinklistExportBg : '#1b1b1e';
                context.fillStyle = bgColor;
                // Fill CSS-sized rect (we scaled the context)
                context.fillRect(0, 0, width, height);

                context.font = "bold 24px Arial";
                context.fillStyle = '#e6e6e6';
                context.fillText('-Extended 1.2 ' + username, 5, 25);

                inputKinks.drawLegend(context);
                return { context: context, canvas: canvas };
            },
        drawCallHandlers: {
            simpleTitle: function(context, drawCall){
                context.fillStyle = '#e6e6e6';
                context.font = "bold 18px Arial";
                context.fillText(drawCall.data, drawCall.x, drawCall.y + 5);
            },
            titleSubtitle: function(context, drawCall){
                context.fillStyle = '#e6e6e6';
                context.font = "bold 18px Arial";
                context.fillText(drawCall.data.category, drawCall.x, drawCall.y + 5);

                var fieldsStr = drawCall.data.fields.join(', ');
                context.font = "italic 12px Arial";
                context.fillText(fieldsStr, drawCall.x, drawCall.y + 20);
            },
            kinkRow: function(context, drawCall){
                context.fillStyle = '#e6e6e6';
                context.font = "12px Arial";

                var x = drawCall.x + 5 + (drawCall.data.choices.length * 20);
                var y = drawCall.y - 6;
                context.fillText(drawCall.data.text, x, y);

                // Circles
                for(var i = 0; i < drawCall.data.choices.length; i++){
                    var choice = drawCall.data.choices[i];
                    var color = colors[choice];

                    var x = 10 + drawCall.x + (i * 20);
                    var y = drawCall.y - 10;

                    context.beginPath();
                    context.arc(x, y, 8, 0, 2 * Math.PI, false);
                    context.fillStyle = color;
                    context.fill();
                    context.strokeStyle = 'rgba(255, 255, 255, 0.06)'
                    context.lineWidth = 1;
                    context.stroke();
                }

            }
        },
        export: function(){
            var username = prompt("Please enter your name");
            if(typeof username !== 'string') return;
            else if (username.length ) username = '(' + username + ')';

            $('#Loading').fadeIn();
            $('#URL').fadeOut();

            // Constants
            var numCols = 6;
            var columnWidth = 250;
            var simpleTitleHeight = 35;
            var titleSubtitleHeight = 50;
            var rowHeight = 25;
            var offsets = {
                left: 10,
                right: 10,
                top: 50,
                bottom: 10
            };

            // Find out how many we have of everything
            var numCats = $('.kinkCategory').length;
            var dualCats = $('.kinkCategory th + th + th').length;
            var simpleCats = numCats - dualCats;
            var numKinks = $('.kinkRow').length;

            // Determine the height required for all categories and kinks
            var totalHeight = (
                    (numKinks * rowHeight) +
                    (dualCats * titleSubtitleHeight) +
                    (simpleCats * simpleTitleHeight)
            );

            // Initialize columns and drawStacks
            var columns = [];
            for(var i = 0; i < numCols; i++){
                columns.push({ height: 0, drawStack: []});
            }

            // Create drawcalls and place them in the drawStack
            // for the appropriate column
            var avgColHeight = totalHeight / numCols;
            var columnIndex = 0;
            $('.kinkCategory').each(function(){
                var $cat = $(this);
                var catName = $cat.data('category');
                var category = kinks[catName];
                var fields = category.fields;
                var catKinks = category.kinks;

                var catHeight = 0;
                catHeight += (fields.length === 1) ? simpleTitleHeight : titleSubtitleHeight;
                catHeight += (catKinks.length * rowHeight);

                // Determine which column to place this category in
                if((columns[columnIndex].height + (catHeight / 2)) > avgColHeight) columnIndex++;
                while(columnIndex >= numCols) columnIndex--;
                var column = columns[columnIndex];

                // Drawcall for title
                var drawCall = { y: column.height };
                column.drawStack.push(drawCall);
                if(fields.length < 2) {
                    column.height += simpleTitleHeight;
                    drawCall.type =  'simpleTitle';
                    drawCall.data = catName;
                }
                else {
                    column.height += titleSubtitleHeight;
                    drawCall.type =  'titleSubtitle';
                    drawCall.data = {
                        category: catName,
                        fields: fields
                    };
                }

                // Drawcalls for kinks
                $cat.find('.kinkRow').each(function(){
                    var $kinkRow = $(this);
                    var drawCall = { y: column.height, type: 'kinkRow', data: {
                            choices: [],
                            text: $kinkRow.data('kink')
                    }};
                    column.drawStack.push(drawCall);
                    column.height += rowHeight;

                    // Add choices
                    $kinkRow.find('.choices').each(function(){
                        var $selection = $(this).find('.choice.selected');
                        var selection = ($selection.length > 0)
                                ? $selection.data('level')
                                : Object.keys(level)[0];

                        drawCall.data.choices.push(selection);
                    });
                });
            });

            var tallestColumnHeight = 0;
            for(var i = 0; i < columns.length; i++){
                if(tallestColumnHeight < columns[i].height) {
                    tallestColumnHeight = columns[i].height;
                }
            }

            var canvasWidth = offsets.left + offsets.right + (columnWidth * numCols);
            var canvasHeight = offsets.top + offsets.bottom + tallestColumnHeight;
            var setup = inputKinks.setupCanvas(canvasWidth, canvasHeight, username);
            var context = setup.context;
            var canvas = setup.canvas;

            for(var i = 0; i < columns.length; i++) {
                var column = columns[i];
                var drawStack = column.drawStack;

                var drawX = offsets.left + (columnWidth * i);
                for(var j = 0; j < drawStack.length; j++){
                    var drawCall = drawStack[j];
                    drawCall.x = drawX;
                    drawCall.y += offsets.top;
                    inputKinks.drawCallHandlers[drawCall.type](context, drawCall);
                }
            }

            //return $(canvas).insertBefore($('#InputList'));

            // If preview flag present, append the canvas to the document and skip upload (for debugging)
            if (typeof window !== 'undefined' && window.kinklistPreview) {
                $(canvas).css({ display: 'block', margin: '10px auto', border: '1px solid #333' });
                $(canvas).insertBefore($('#InputList'));
                $('#Loading').hide();
                $('#URL').val('preview').fadeIn();
                return;
            }

            // Send canvas to imgur
            $.ajax({
                url: 'https://api.imgur.com/3/image',
                type: 'POST',
                headers: {
                    // Your application gets an imgurClientId from Imgur
                    Authorization: 'Client-ID ' + imgurClientId,
                    Accept: 'application/json'
                },
                data: {
                    // convert the image data to base64
                    image:  canvas.toDataURL().split(',')[1],
                    type: 'base64'
                },
                success: function(result) {
                    $('#Loading').hide();
                    var url = 'https://i.imgur.com/' + result.data.id + '.png';
                    $('#URL').val(url).fadeIn();
                },
                fail: function(){
                    $('#Loading').hide();
                    alert('Failed to upload to imgur, could not connect');
                }
            });
        },
        encode: function(base, input){
            var hashBase = inputKinks.hashChars.length;
            var outputPow = inputKinks.maxPow(hashBase, Number.MAX_SAFE_INTEGER);
            var inputPow = inputKinks.maxPow(base, Math.pow(hashBase, outputPow));

            var output = "";
            var numChunks = Math.ceil(input.length / inputPow);
            var inputIndex = 0;
            for(var chunkId = 0; chunkId < numChunks; chunkId++) {
                var inputIntValue = 0;
                for(var pow = 0; pow < inputPow; pow++) {
                    var inputVal = input[inputIndex++];
                    if(typeof inputVal === "undefined") break;
                    var val = inputVal * Math.pow(base, pow);
                    inputIntValue += val;
                }

                var outputCharValue = "";
                while(inputIntValue > 0) {
                    var maxPow = Math.floor(log(inputIntValue, hashBase));
                    var powVal = Math.pow(hashBase, maxPow);
                    var charInt = Math.floor(inputIntValue / powVal);
                    var subtract = charInt * powVal;
                    var char = inputKinks.hashChars[charInt];
                    outputCharValue += char;
                    inputIntValue -= subtract;
                }
                var chunk = inputKinks.prefix(outputCharValue, outputPow, inputKinks.hashChars[0]);
                output += chunk;
            }
            return output;
        },
        decode: function(base, output){
            var hashBase = inputKinks.hashChars.length;
            var outputPow = inputKinks.maxPow(hashBase, Number.MAX_SAFE_INTEGER);

            var values = [];
            var numChunks = Math.max(output.length / outputPow)
            for(var i = 0; i < numChunks; i++){
                var chunk = output.substring(i * outputPow, (i + 1) * outputPow);
                var chunkValues = inputKinks.decodeChunk(base, chunk);
                for(var j = 0; j < chunkValues.length; j++) {
                    values.push(chunkValues[j]);
                }
            }
            return values;
        },
        decodeChunk: function(base, chunk){
            var hashBase = inputKinks.hashChars.length;
            var outputPow = inputKinks.maxPow(hashBase, Number.MAX_SAFE_INTEGER);
            var inputPow = inputKinks.maxPow(base, Math.pow(hashBase, outputPow));

            var chunkInt = 0;
            for(var i = 0; i < chunk.length; i++) {
                var char = chunk[i];
                var charInt = inputKinks.hashChars.indexOf(char);
                var pow = chunk.length - 1 - i;
                var intVal = Math.pow(hashBase, pow) * charInt;
                chunkInt += intVal;
            }
            var chunkIntCopy = chunkInt;

            var output = [];
            for(var pow = inputPow - 1; pow >= 0; pow--) {
                var posBase = Math.floor(Math.pow(base, pow));
                var posVal = Math.floor(chunkInt / posBase);
                var subtract = posBase * posVal;
                output.push(posVal);
                chunkInt -= subtract;
            }
            output.reverse();
            return output;
        },
        updateHash: function(){
            var hashValues = [];
            $('#InputList .choices').each(function(){
                var $this = $(this);
                var lvlInt = $this.find('.selected').data('levelInt');
                if(!lvlInt) lvlInt = 0;
                hashValues.push(lvlInt);
            });
            // Removed console logging to reduce console noise in production
            return inputKinks.encode(Object.keys(colors).length, hashValues);
        },
        parseHash: function(){
            // Prevent re-entrant calls; clear any pending retry
            if (isHashUpdating) return;
            if (parseHashTimeout) {
                clearTimeout(parseHashTimeout);
                parseHashTimeout = null;
            }
            isHashUpdating = true;

            // If we are actively scrolling or recently scrolled, delay parsing hash until scrolling settles.
            var now = (new Date()).getTime();
            if (window.isScrolling || (now - lastScrollTime) < 1000) {
                // Clear and set a single retry timer
                if (parseHashTimeout) clearTimeout(parseHashTimeout);
                parseHashTimeout = setTimeout(function(){
                    parseHashTimeout = null;
                    isHashUpdating = false;
                    inputKinks.parseHash();
                }, 1000);
                return;
            }

            let hash = location.hash.substring(1);
            if(hash.length < 10) {
                isHashUpdating = false;
                return;
            }

            let values = inputKinks.decode(Object.keys(colors).length, hash);
            // select correct kink list
            const _kinkSizes = (typeof window !== 'undefined' && window.kinkSizes) ? window.kinkSizes : kinkSizes;
            const kinkListHashOption = _kinkSizes[values.length.toString()];
            if (kinkListHashOption !== undefined) {
                // Kink list size mapping found; proceed
                let $listType = $('#listType');
                $listType.val(kinkListHashOption);
                LoadList().then(function() {
                    runAfterScrollSettled(function(){ inputKinks.applySaveToList(values); }, 0);
                    isHashUpdating = false;
                });
                return;
            }
            this.applySaveToList(values);
            isHashUpdating = false;
        },
        applySaveToList: function(values){
            allowHashUpdate = false;
            var $choices = $('#InputList .choices');
            for(var i = 0; i < values.length && i < $choices.length; i++){
                var levelInt = values[i];
                var $choice = $choices.eq(i);
                $choice.find('.choice').removeClass('selected');
                $choice.find('.choice').eq(levelInt).addClass('selected');
            }
            setTimeout(function(){
                allowHashUpdate = true;
                inputKinks.updateSelectionStateFromDOM();
            }, 100);
        },
        saveSelection: function(){
            var selection = [];
            $('.choice.selected').each(function(){
                // .choice selector
                var selector = '.' + this.className.replace(/ /g, '.');
                // .choices selector
                selector = '.' + $(this).closest('.choices')[0].className.replace(/ /g, '.') + ' ' + selector;
                // .kinkRow selector
                selector = '.' + $(this).closest('tr.kinkRow')[0].className.replace(/ /g, '.') + ' ' + selector;
                // .kinkCategory selector
                selector = '.' + $(this).closest('.kinkCategory')[0].className.replace(/ /g, '.') + ' ' + selector;
                selector = selector.replace('.selected', '');
                selection.push(selector);
            });
            return selection;
        },
        saveSelectionIndices: function(){
            var selection = [];
            $('#InputList .choices').each(function(){
                var $selected = $(this).find('.choice.selected');
                if($selected.length > 0) selection.push($selected.index());
                else selection.push(-1);
            });
            return selection;
        },
        saveSelectionKeys: function(){
            var selection = [];
            $('#InputList .choices').each(function(){
                var $choices = $(this);
                var $kinkRow = $choices.closest('tr.kinkRow');
                var $cat = $choices.closest('.kinkCategory');
                if(!$kinkRow.length || !$cat.length) {
                    // can't determine key for this entry
                    selection.push(null);
                    return;
                }
                var category = $cat.data('category');
                var kink = $kinkRow.data('kink');
                var field = $choices.data('field');
                var key = strToClass(category) + '|' + strToClass(kink) + '|' + strToClass(field);
                var lvl = (typeof inputKinks.selectionState[key] === 'number') ? inputKinks.selectionState[key] : -1;
                selection.push({ category: category, kink: kink, field: field, levelIndex: lvl });
            });
            return selection;
        },
        updateSelectionStateFromDOM: function(){
            inputKinks.selectionState = {};
            $('#InputList .choices').each(function(){
                var $choices = $(this);
                var $kinkRow = $choices.closest('tr.kinkRow');
                var $cat = $choices.closest('.kinkCategory');
                if(!$kinkRow.length || !$cat.length) return;
                var category = $cat.data('category');
                var kink = $kinkRow.data('kink');
                var field = $choices.data('field');
                var $selected = $choices.find('.choice.selected');
                var lvl = ($selected.length > 0) ? $selected.index() : -1;
                var key = strToClass(category) + '|' + strToClass(kink) + '|' + strToClass(field);
                inputKinks.selectionState[key] = lvl;
            });
        },
        restoreSavedSelectionFromKeys: function(keys, updateHash = true){
            allowHashUpdate = false;
            setTimeout(function(){
                for(var i = 0; i < keys.length; i++){
                    var obj = keys[i];
                    if(!obj) continue;
                    var selector = '.cat-' + strToClass(obj.category) + ' .kink-' + strToClass(obj.kink) + ' .choice-' + strToClass(obj.field);
                    // debugging: selector being restored
                    var $choices = $(selector);
                    if($choices.length === 0) continue;
                    $choices.find('.choice').removeClass('selected');
                    if(typeof obj.levelIndex === 'number' && obj.levelIndex >= 0) {
                        $choices.find('.choice').eq(obj.levelIndex).addClass('selected');
                    }
                }
                allowHashUpdate = true;
                if (updateHash) {
                    isHashUpdating = true;
                    setHashWithoutScroll(inputKinks.updateHash());
                    setTimeout(function() {
                        isHashUpdating = false;
                    }, 100);
                }
                // Update selectionState to match restored DOM selections
                inputKinks.updateSelectionStateFromDOM();
            }, 300);
        },
        restoreSavedSelectionIndices: function(indices, updateHash = true){
            allowHashUpdate = false;
            setTimeout(function(){
                $('#InputList .choices').each(function(i){
                    var lvl = indices[i];
                    var $choices = $(this);
                    $choices.find('.choice').removeClass('selected');
                    if(typeof lvl === 'number' && lvl >= 0) {
                        $choices.find('.choice').eq(lvl).addClass('selected');
                    }
                });
                allowHashUpdate = true;
                if (updateHash) {
                    isHashUpdating = true;
                    setHashWithoutScroll(inputKinks.updateHash());
                    setTimeout(function() {
                        isHashUpdating = false;
                    }, 100);
                }
                inputKinks.updateSelectionStateFromDOM();
            }, 300);
        },
        inputListToText: function(){
            var KinksText = "";
            var kinkCats = Object.keys(kinks);
            for(var i = 0; i < kinkCats.length; i++){
                var catName = kinkCats[i];
                var catFields = kinks[catName].fields;
                var catKinks = kinks[catName].kinks;
                KinksText += '#' + catName + "\r\n";
                KinksText += '(' + catFields.join(', ') + ")\r\n";
                for(var j = 0; j < catKinks.length; j++){
                    KinksText += '* ' + catKinks[j].kinkName + "\r\n";
                    if(catKinks[j].kinkDesc) 
                        { KinksText += '? ' + catKinks[j].kinkDesc + "\r\n"; }
                }
                KinksText += "\r\n";
            }
            return KinksText;
        },
        restoreSavedSelection: function(selection, updateHash = true){
            allowHashUpdate = false;
            setTimeout(function(){
                for(var i = 0; i < selection.length; i++){
                    var selector = selection[i];
                    $(selector).addClass('selected');
                }
                allowHashUpdate = true;
                if (updateHash) {
                    isHashUpdating = true;
                    setHashWithoutScroll(inputKinks.updateHash());
                    setTimeout(function() {
                        isHashUpdating = false;
                    }, 100);
                }
                inputKinks.updateSelectionStateFromDOM();
            }, 300);
        },
        parseKinksText: function(kinksText){
            var newKinks = {};
            var lines = kinksText.replace(/\r/g, '').split("\n");

            var cat = null;
            var catName = null;
            for(var i = 0; i < lines.length; i++){
                var line = lines[i];
                if(!line.length) continue;

                if(line[0] === '#') {
                    if(catName){
                        if(!(cat.fields instanceof Array) || cat.fields.length < 1){
                            alert(catName + ' does not have any fields defined!');
                            return;
                        }
                        if(!(cat.kinks instanceof Array) || cat.kinks.length < 1){
                            alert(catName + ' does not have any kinks listed!');
                            return;
                        }
                        newKinks[catName] = cat;
                    }
                    catName = line.substring(1).trim();
                    cat = { kinks: [] };
                }
                if(!catName) continue;
                if(line[0] === '(') {
                    cat.fields = line.substring(1, line.length - 1).trim().split(',');
                    for(var j = 0; j < cat.fields.length; j++){
                        cat.fields[j] = cat.fields[j].trim();
                    }
                }
                if(line[0] === '*'){
                    var kink = {};
                    kink.kinkName = line.substring(1).trim();
                    cat.kinks.push(kink);
                }
                if(line[0] === '?'){
                    kink.kinkDesc = line.substring(1).trim();
                }
            }
            if(catName && !newKinks[catName]){
                if(!(cat.fields instanceof Array) || cat.fields.length < 1){
                    alert(catName + ' does not have any fields defined!');
                    return;
                }
                if(!(cat.kinks instanceof Array) || cat.kinks.length < 1){
                    alert(catName + ' does not have any kinks listed!');
                    return;
                }
                newKinks[catName] = cat;
            }
            return newKinks;
        }					
    };

    $('#Edit').on('click', function(){
        var KinksText = inputKinks.inputListToText();
        $('#Kinks').val(KinksText.trim());
        $('#EditOverlay').fadeIn();
    });
    $('#EditOverlay').on('click', function(){
        $(this).fadeOut();
    });
    $('#KinksOK').on('click', function(){
        var selection = inputKinks.saveSelection();
        try {
            var kinksText = $('#Kinks').val();
            kinks = inputKinks.parseKinksText(kinksText);
            inputKinks.fillInputList();
        }
        catch(e){
            alert('An error occured trying to parse the text entered, please correct it and try again');
            return;
        }
        inputKinks.restoreSavedSelection(selection);
        $('#EditOverlay').fadeOut();
    });
    $('.overlay > *').on('click', function(e){
        e.stopPropagation();
    });
    $('#DescriptionOverlay').on('click', function(){
        $(this).fadeOut();
    });
    $('#Description').on('click', function(){
        $('#DescriptionOverlay').fadeOut();
    });

    function showDescriptionButton(description, attachElement) {
        $('<Button />', { "class": 'KinkDesc',  click: function() {
                                                    $('#Description').text(description);
                                                    $('#DescriptionOverlay').fadeIn();} 
        }).appendTo(attachElement);
    }

    var stylesheet = document.styleSheets[0];
    $('.legend .choice').each(function(){
        var $choice = $(this);
        var $parent = $choice.parent();
        var text = $parent.text().trim();
        var color = $choice.data('color');
        var cssClass = this.className.replace('choice ', '').trim();

        addCssRule('.choice.' + cssClass, 'background-color: ' + color + ';');
        colors[text] = color;
        level[text] = cssClass;
    });

    kinks = inputKinks.parseKinksText($('#Kinks').text().trim());
    inputKinks.init();

    // Add hashchange event listener to handle browser navigation
    $(window).on('hashchange', function() {
        if (!isHashUpdating && typeof isScrolling !== 'undefined' && !isScrolling) {
            inputKinks.parseHash();
        }
    });

    // Prevent hash updates during active scrolling on mobile
    window.isScrolling = false;
    $(window).on('scroll touchmove', function() {
        window.isScrolling = true;
        lastScrollTime = (new Date()).getTime();
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(function() {
            window.isScrolling = false;
        }, 150);
    });

    (function(){
        var $popup = $('#InputOverlay');
        var $previous = $('#InputPrevious');
        var $next = $('#InputNext');

        // current
        var $category = $('#InputCategory');
        var $field = $('#InputField');
        var $options = $('#InputValues');

        function getChoiceValue($choices){
            var $selected = $choices.find('.choice.selected');
            return $selected.data('level');
        }

        function getChoicesElement(category, kink, field){
            var selector = '.cat-' + strToClass(category);
            selector += ' .kink-' + strToClass(kink.kinkName);
            selector += ' .choice-' + strToClass(field);

            var $choices = $(selector);
            return $choices;
        }

        inputKinks.getAllKinks = function(){
            var list = [];

            var categories = Object.keys(kinks);
            for(var i = 0; i < categories.length; i++){
                var category = categories[i];
                var fields = kinks[category].fields;
                var kinkArr = kinks[category].kinks;

                for(var j = 0; j < fields.length; j++) {
                    var field = fields[j];
                    for(var k = 0; k < kinkArr.length; k++){
                        var kink = kinkArr[k];
                        var $choices = getChoicesElement(category, kink, field);
                        var value = getChoiceValue($choices);
                        var obj = { category: category, kink: {name: kink.kinkName, desc: kink.kinkDesc}, field: field, value: value, $choices: $choices, showField: (fields.length >= 2)};
                        list.push(obj);
                    }
                }

            }
            return list;
        };

        inputKinks.inputPopup = {
            numPrev: 3,
            numNext: 3,
            allKinks: [],
            kinkByIndex: function(i){
                var numKinks = inputKinks.inputPopup.allKinks.length;
                i = (numKinks + i) % numKinks;
                return inputKinks.inputPopup.allKinks[i];
            },
            generatePrimary: function(kink){
                var $container = $('<div>');
                var btnIndex = 0;
                $('.legend > div').each(function(){
                    var $btn = $(this).clone();
                    $btn.addClass('big-choice');
                    $btn.appendTo($container);

                    $('<span>')
                            .addClass('btn-num-text')
                            .text(btnIndex++)
                            .appendTo($btn)

                    var text = $btn.text().trim().replace(/[0-9]/g, '');
                    if(kink.value === text) {
                        $btn.addClass('selected');
                    }

                    $btn.on('click', function(){
                        $container.find('.big-choice').removeClass('selected');
                        $btn.addClass('selected');
                        kink.value = text;
                        $options.fadeOut(200, function(){
                            $options.show();
                            inputKinks.inputPopup.showNext();
                        });
                        var choiceClass = strToClass(text);
                        kink.$choices.find('.' + choiceClass).click();
                    });
                });
                return $container;
            },
            generateSecondary: function(kink){
                var $container = $('<div class="kink-simple">');
                $('<span class="choice">').addClass(level[kink.value]).appendTo($container);
                $('<span class="txt-category">').text(kink.category).appendTo($container);
                if(kink.showField){
                    $('<span class="txt-field">').text(kink.field).appendTo($container);
                }
                $('<span class="txt-kink">').text(kink.kink.name).appendTo($container);
                return $container;
            },
            showIndex: function(index){
                $previous.html('');
                $next.html('');
                $options.html('');
                $popup.data('index', index);

                // Current
                var currentKink = inputKinks.inputPopup.kinkByIndex(index);
                var $currentKink = inputKinks.inputPopup.generatePrimary(currentKink);
                $options.append($currentKink);
                $category.text(currentKink.category);
                var label = $field.text((currentKink.showField ? '(' + currentKink.field + ') ' : '') + currentKink.kink.name);
                if(currentKink.kink.desc) {showDescriptionButton(currentKink.kink.desc, label);}
                $options.append($currentKink);

                // Prev
                for(var i = inputKinks.inputPopup.numPrev; i > 0; i--){
                    var prevKink = inputKinks.inputPopup.kinkByIndex(index - i);
                    var $prevKink = inputKinks.inputPopup.generateSecondary(prevKink);
                    $previous.append($prevKink);
                    (function(skip){
                        $prevKink.on('click', function(){
                            inputKinks.inputPopup.showPrev(skip);
                        });
                    })(i);
                }
                // Next
                for(var i = 1; i <= inputKinks.inputPopup.numNext; i++){
                    var nextKink = inputKinks.inputPopup.kinkByIndex(index + i);
                    var $nextKink = inputKinks.inputPopup.generateSecondary(nextKink);
                    $next.append($nextKink);
                    (function(skip){
                        $nextKink.on('click', function(){
                            inputKinks.inputPopup.showNext(skip);
                        });
                    })(i);
                }
            },
            showPrev: function(skip){
                if(typeof skip !== "number") skip = 1;
                var index = $popup.data('index') - skip;
                var numKinks = inputKinks.inputPopup.allKinks.length;
                index = (numKinks + index) % numKinks;
                inputKinks.inputPopup.showIndex(index);
            },
            showNext: function(skip){
                if(typeof skip !== "number") skip = 1;
                var index = $popup.data('index') + skip;
                var numKinks = inputKinks.inputPopup.allKinks.length;
                index = (numKinks + index) % numKinks;
                inputKinks.inputPopup.showIndex(index);
            },
            show: function(){
                inputKinks.inputPopup.allKinks = inputKinks.getAllKinks();
                inputKinks.inputPopup.showIndex(0);
                $popup.fadeIn();
            }
        };

        $(window).on('keydown', function(e){
            if(e.altKey || e.shiftKey || e.ctrlKey) return;
            if(!$popup.is(':visible')) return;

            if(e.keyCode === 38) {
                inputKinks.inputPopup.showPrev();
                e.preventDefault();
                e.stopPropagation();
            }
            if(e.keyCode === 40) {
                inputKinks.inputPopup.showNext();
                e.preventDefault();
                e.stopPropagation();
            }

            var btn = -1;
            if(e.keyCode >= 96 && e.keyCode <= 101) {
                btn = e.keyCode - 96;
            }
            else if(e.keyCode >= 48 && e.keyCode <= 53) {
                btn = e.keyCode - 48;
            }
            else {
                return;
            }

            var $btn = $options.find('.big-choice').eq(btn);
            $btn.click();
        });
        $('#StartBtn').on('click', inputKinks.inputPopup.show);
        $('#InputCurrent .closePopup, #InputOverlay').on('click', function(){
            $popup.fadeOut();
        });                    
    })();
});