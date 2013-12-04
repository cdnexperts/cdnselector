/**
* jQuery PartitionSlider Plugin
* Version: 0.1.0
* URL: http://github.com/4ndreaSt4gi/PartitionSlider
* Description: JQuery plugin to make a partition editor widget.
* Requires: JQuery
* Author: Andrea Stagi
* Copyright: 2011 Andrea Stagi
* License: MIT (included in the source)
*/

(function($) {

    $.fn.extend({

        PartitionSlider: function(options) {

            var defaults =  {
                containerId : $(this).attr('id'),
                values : [ 25, 25, 25, 25 ],
                colors : [ "green", "grey", "black", "orange" ],
                create : null
            }

            var parameters = $.extend(defaults, options);
            var nElements = parameters.values.length;
            var rangesWidth = 0;

            var currentCursor = {
                leftRangeDivId: null,
                rightRangeDivId : null,
                oldPosition : 0,
            };

            var mouseMoveContext = {
                delta: 0,
                widthLeft : 0,
                widthRight : 0,
                widthTotal : 0,
                oldValue : -1,
                widths : []
            };

            function createMe(parameters) {

                var height = $("#" + parameters.containerId).height();
                var normWidth = (($("#" + parameters.containerId).width() - (height) * (nElements - 1)) / 100) - 1;
                var div = "";
                var rangeWidth = 0;
                var cursorId = 0;
                var cursorMap = {};

                for(var i = 0; i < nElements; i++) {
                    rangeWidth = parameters.values[i] * normWidth;

                    div = "<div style='float:left;" +

                                "background-color:" + parameters.colors[i] + ";" +
                                "height:" + height + "px;" +
                                "width:" + rangeWidth + "px;' " +
                                "id='range" + i + "' class='rangeDiv'></div>";

                    mouseMoveContext.widths[i] = rangeWidth;

                    rangesWidth += rangeWidth;

                    $("#" + parameters.containerId).append(div);

                    if (i != nElements - 1) {
                        cursorId = "cursor" + i;
                        div = "<div style='float:left;" +
                                    "background-color: #e6e6e6;" +
                                    "cursor:pointer;" +
                                    "height:" + height + "px;" +
                                    "width:" + height + "px;' " +
                                    "id='" + cursorId + "' class='dragCursor fa fa-2x fa-arrows-h'></div>";
                        $("#" + parameters.containerId).append(div);
                        cursorMap[cursorId] = i;
                    }
                }


                $("#" + parameters.containerId).append("<div style='clear:both'></div>");


                $("#" + parameters.containerId + ' .dragCursor').mousedown(function(event) {
                    var selectedCursor = cursorMap[$(this).attr('id')];
                    currentCursor.leftRangeDivId = "#" + parameters.containerId + ' #range' + selectedCursor;
                    currentCursor.rightRangeDivId = "#" + parameters.containerId + ' #range' + (selectedCursor + 1);
                    currentCursor.leftRangeDivNum = selectedCursor;
                    currentCursor.rightRangeDivNum = selectedCursor + 1;
                    currentCursor.oldPosition = event.pageX;
                    mouseMoveContext.widthTotal = $(currentCursor.leftRangeDivId).width() + $(currentCursor.rightRangeDivId).width();
                    $(document).bind("mousemove", {selectedCursor: selectedCursor}, onMouseMove);
                    $(document).bind("mouseup", onMouseUp);
                    event.preventDefault();
                });

            }

            function onMouseMove(event) {

                if(mouseMoveContext.oldValue == -1)
                    mouseMoveContext.oldValue = parameters.values[event.data.selectedCursor + 1] +
                        parameters.values[event.data.selectedCursor];

                with(mouseMoveContext) {


                    if (currentCursor.oldPosition == event.pageX)
                        return;

                    delta = currentCursor.oldPosition - event.pageX;

                    widthLeft = widths[currentCursor.leftRangeDivNum] - delta;
                    widthRight = widths[currentCursor.rightRangeDivNum] + delta;



                    if (widthLeft < 0 || widthRight < 0)
                    {
                        currentCursor.oldPosition = event.pageX;
                        return;
                    }

                    widths[currentCursor.leftRangeDivNum] = widthLeft;
                    widths[currentCursor.rightRangeDivNum] = widthRight;
                    $(currentCursor.leftRangeDivId).width(widthLeft);
                    $(currentCursor.rightRangeDivId).width(widthRight);


                    currentCursor.oldPosition = event.pageX;

                }

                parameters.values[event.data.selectedCursor] = Math.round(mouseMoveContext.widthLeft / rangesWidth * 100);
                parameters.values[event.data.selectedCursor + 1] = Math.round(mouseMoveContext.widthRight / rangesWidth * 100);

                normalizeValues(event.data.selectedCursor, event.data.selectedCursor + 1);

                if(parameters.values[event.data.selectedCursor] == 0)
                {
                    $(currentCursor.rightRangeDivId).width(mouseMoveContext.widthLeft + mouseMoveContext.widthRight);
                    $(currentCursor.leftRangeDivId).width(0);
                }

                if(parameters.values[event.data.selectedCursor + 1] == 0)
                {
                    $(currentCursor.leftRangeDivId).width(mouseMoveContext.widthLeft + mouseMoveContext.widthRight);
                    $(currentCursor.rightRangeDivId).width(0);
                }

                if (parameters.onCursorDrag != null)
                    parameters.onCursorDrag(event.data.selectedCursor, parameters.values);

            }

            function onMouseUp(event) {
                $(document).unbind("mousemove", onMouseMove);
                $(document).unbind("mouseup", onMouseUp);
                mouseMoveContext.oldValue = -1;
                if (parameters.onCursorDragComplete != null)
                        parameters.onCursorDragComplete(parameters.values);
            }

            function normalizeValues(first, second) {
                var delta = (parameters.values[first] + parameters.values[second]) - mouseMoveContext.oldValue;
                if(parameters.values[second] > parameters.values[first])
                    parameters.values[second] -= delta;
                else
                    parameters.values[first] -= delta;
            }

            createMe(parameters);

            if (parameters.create != null)
                parameters.create(parameters.values, parameters.colors);

        }
    });

})(jQuery);
