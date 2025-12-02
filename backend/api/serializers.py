from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from .models import Category, ChimneyDesign, UserProject, Order, ContactMessage


class UserSerializer(serializers.ModelSerializer):
    """User serializer"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'date_joined']
        read_only_fields = ['id', 'date_joined']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """User registration serializer"""
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name', 'last_name']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class CategorySerializer(serializers.ModelSerializer):
    """Category serializer"""
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'created_at']


class ChimneyDesignSerializer(serializers.ModelSerializer):
    """Chimney Design serializer"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = ChimneyDesign
        fields = [
            'id', 'title', 'description', 'category', 'category_name',
            'model_file', 'model_data', 'width', 'height', 'depth',
            'material_type', 'color', 'price', 'thumbnail',
            'is_featured', 'is_active', 'created_by', 'created_by_username',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class ChimneyDesignListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for design lists"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = ChimneyDesign
        fields = [
            'id', 'title', 'description', 'category_name',
            'thumbnail', 'price', 'is_featured', 'created_at'
        ]


class UserProjectSerializer(serializers.ModelSerializer):
    """User Project serializer"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    base_design_title = serializers.CharField(source='base_design.title', read_only=True)
    
    class Meta:
        model = UserProject
        fields = [
            'id', 'user', 'user_username', 'name', 'description',
            'design_data', 'model_data', 'base_design', 'base_design_title',
            'is_public', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']


class OrderSerializer(serializers.ModelSerializer):
    """Order serializer"""
    user_username = serializers.CharField(source='user.username', read_only=True)
    design_title = serializers.CharField(source='design.title', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id', 'user', 'user_username', 'design', 'design_title',
            'project', 'quantity', 'total_price', 'status', 'status_display',
            'customer_name', 'customer_email', 'customer_phone', 'shipping_address',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']


class ContactMessageSerializer(serializers.ModelSerializer):
    """Contact Message serializer"""
    class Meta:
        model = ContactMessage
        fields = ['id', 'name', 'email', 'subject', 'message', 'is_read', 'created_at']
        read_only_fields = ['is_read', 'created_at']

