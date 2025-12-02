from rest_framework import serializers
from .models import Project, Item


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = [
            'id', 'item_code', 'location', 'model', 'model_type', 'length', 'width', 'height',
            'exhaust_collar_dm', 'filter_item_code', 'filter_dimension',
            'filter_qty', 'filter_length', 'watts', 'cmh_cfm', 'collar_static_pressure',
            'fresh_air_qty', 'front_panel_thickness', 'skin_type', 'make',
            'uv_lamp_cutout', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProjectSerializer(serializers.ModelSerializer):
    items = ItemSerializer(many=True, read_only=True)
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'project_name', 'client_name', 'customer_code', 'date',
            'location', 'drawing_type', 'sheet_type', 'dim_section1',
            'dim_section2', 'dim_section3', 'dim_section4', 'dim_section5', 'items',
            'total_items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_items(self, obj):
        return obj.items.count()


class ProjectListSerializer(serializers.ModelSerializer):
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'project_name', 'client_name', 'customer_code', 'date',
            'location', 'drawing_type', 'sheet_type', 'total_items',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_items(self, obj):
        return obj.items.count()


