from django.contrib import admin
from .models import Project, Item


class ItemInline(admin.TabularInline):
    model = Item
    extra = 1


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['project_name', 'client_name', 'customer_code', 'date', 'drawing_type', 'created_at']
    list_filter = ['drawing_type', 'sheet_type', 'created_at']
    search_fields = ['project_name', 'client_name', 'customer_code']
    inlines = [ItemInline]


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['item_code', 'project', 'model', 'location', 'created_at']
    list_filter = ['created_at', 'project']
    search_fields = ['item_code', 'model', 'location', 'project__project_name']


