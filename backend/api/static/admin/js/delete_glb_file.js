// JavaScript to handle GLB file deletion in Django admin
// Ensure jQuery is available - use django.jQuery if available
(function($) {
    'use strict';
    
    // Fallback if $ is not defined
    if (typeof $ === 'undefined') {
        if (typeof django !== 'undefined' && django.jQuery) {
            $ = django.jQuery;
        } else if (typeof jQuery !== 'undefined') {
            $ = jQuery;
        } else {
            console.error('jQuery is not available. Quick Delete will not work.');
            return;
        }
    }
    
    // Get CSRF token helper
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    
    // Global function to delete GLB file - deletes only the specific file clicked
    window.deleteGLBFile = function(fileId) {
        const $button = $('button[data-file-id="' + fileId + '"]');
        const fileName = $button.data('file-name') || 'this file';
        const fileType = $button.data('file-type') || 'file';
        
        // Clear confirmation message showing exactly which file will be deleted
        const confirmMessage = 'Are you sure you want to delete this GLB ' + fileType + ' file?\n\n' +
                              'File: ' + fileName + '\n\n' +
                              '⚠️ WARNING: This will delete ONLY this specific file.\n' +
                              'This action cannot be undone.';
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        const csrftoken = getCookie('csrftoken');
        const deleteUrl = '/api/delete-glb-file/?id=' + fileId;
        
        // Find the row
        const $row = $button.closest('tr');
        
        // Disable button and show loading
        $button.prop('disabled', true).html('⏳ Deleting...');
        
        // Make DELETE request
        $.ajax({
            url: deleteUrl,
            type: 'DELETE',
            headers: {
                'X-CSRFToken': csrftoken
            },
            success: function(response) {
                const message = response.message || 'GLB file deleted successfully';
                const deletedFileName = response.deleted_file_name || fileName;
                
                // Show success message using Django admin's message system
                const $messages = $('.messagelist');
                if ($messages.length === 0) {
                    $messages = $('<ul class="messagelist"></ul>');
                    $('.submit-row').before($messages);
                }
                $messages.append('<li class="success">✅ ' + message + '</li>');
                
                // Remove the row with animation
                $row.fadeOut(400, function() {
                    $(this).remove();
                    
                    // Update formset count if needed
                    const totalFormsInput = $('input[name*="-TOTAL_FORMS"]');
                    if (totalFormsInput.length) {
                        const currentCount = parseInt(totalFormsInput.val()) || 0;
                        if (currentCount > 0) {
                            totalFormsInput.val(currentCount - 1);
                        }
                    }
                    
                    // Reload page after a short delay to refresh the formset
                    setTimeout(function() {
                        window.location.reload();
                    }, 800);
                });
            },
            error: function(xhr, status, error) {
                // Re-enable button
                $button.prop('disabled', false).html('🗑️ Quick Delete');
                
                // Show error message
                let errorMessage = 'Failed to delete GLB file.';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage = xhr.responseJSON.error;
                } else if (xhr.status === 403) {
                    errorMessage = 'Permission denied. You do not have permission to delete this file.';
                } else if (xhr.status === 404) {
                    errorMessage = 'GLB file not found.';
                } else if (xhr.status === 401) {
                    errorMessage = 'Authentication required. Please log in again.';
                }
                
                // Show error using Django admin's message system
                const $messages = $('.messagelist');
                if ($messages.length === 0) {
                    $messages = $('<ul class="messagelist"></ul>');
                    $('.submit-row').before($messages);
                }
                $messages.append('<li class="error">Error: ' + errorMessage + '</li>');
                
                console.error('Delete error:', error, xhr.responseJSON);
            }
        });
    };
    
    // Handle clicks via event delegation - ensure it works even after page reloads
    $(document).ready(function() {
        // Use event delegation to catch clicks even on dynamically added buttons
        $(document).on('click', '.delete-glb-file-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const fileId = $(this).data('file-id');
            console.log('Quick Delete clicked for file ID:', fileId); // Debug log
            
            if (fileId) {
                window.deleteGLBFile(fileId);
            } else {
                console.error('No file ID found on delete button');
                alert('Error: Could not find file ID. Please refresh the page and try again.');
            }
        });
        
        // Also ensure jQuery is loaded
        if (typeof jQuery === 'undefined' && typeof django !== 'undefined' && django.jQuery) {
            window.$ = django.jQuery;
            window.jQuery = django.jQuery;
        }
    });
    
})(django.jQuery || jQuery);

