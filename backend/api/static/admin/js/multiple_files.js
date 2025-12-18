// Custom JavaScript to enhance multiple file upload
(function($) {
    'use strict';
    
    $(document).ready(function() {
        // Change file input button text to "Choose Files"
        $('.multiple-file-input').each(function() {
            var $input = $(this);
            
            // Update button text
            $input.on('change', function() {
                var files = this.files;
                if (files.length > 1) {
                    var $label = $input.closest('td').find('label, .help');
                    if ($label.length) {
                        $label.text('Selected ' + files.length + ' files');
                    }
                }
            });
            
            // Add custom styling
            $input.css({
                'padding': '8px',
                'border': '2px dashed #ccc',
                'border-radius': '4px',
                'background-color': '#f9f9f9',
                'cursor': 'pointer',
                'width': '100%'
            });
        });
        
        // Add help text for multiple file selection
        $('.multiple-file-input').after(
            '<small style="display: block; margin-top: 5px; color: #666;">' +
            '💡 Tip: Hold Ctrl (Windows) or Cmd (Mac) and click to select multiple files' +
            '</small>'
        );
    });
})(django.jQuery);

