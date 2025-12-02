from django.db import models
from django.utils import timezone


class Project(models.Model):
    DRAWING_TYPE_CHOICES = [
        ('shop', 'Shop Drawing'),
        ('production', 'Production Drawing'),
        ('both', 'Both'),
    ]

    SHEET_TYPE_CHOICES = [
        ('202', 'Sheet 202'),
        ('304', 'Sheet 304'),
    ]

    project_name = models.CharField(max_length=255)
    client_name = models.CharField(max_length=255)
    customer_code = models.CharField(max_length=100, blank=True)
    date = models.DateField(default=timezone.now)
    location = models.CharField(max_length=255, blank=True)
    drawing_type = models.CharField(max_length=20, choices=DRAWING_TYPE_CHOICES, blank=True)
    sheet_type = models.CharField(max_length=10, choices=SHEET_TYPE_CHOICES, blank=True)
    dim_section1 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    dim_section2 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    dim_section3 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    dim_section4 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    dim_section5 = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.project_name


class Item(models.Model):
    SKIN_TYPE_CHOICES = [
        ('single', 'Single Skin'),
        ('double', 'Double Skin'),
    ]

    MODEL_TYPE_CHOICES = [
        ('WMSS', 'WMSS'),
        ('WMSP', 'WMSP'),
        ('WMDS', 'WMDS'),
        ('WMC', 'WMC'),
        ('UVC', 'UVC'),
        ('ISS', 'ISS'),
        ('ISP', 'ISP'),
        ('IDS', 'IDS'),
        ('IC', 'IC'),
    ]

    project = models.ForeignKey(Project, related_name='items', on_delete=models.CASCADE)
    item_code = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=255, blank=True)
    model = models.CharField(max_length=255, blank=True)
    length = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    width = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    height = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    exhaust_collar_dm = models.CharField(max_length=100, blank=True)
    filter_item_code = models.CharField(max_length=100, blank=True)
    filter_dimension = models.CharField(max_length=100, blank=True)
    filter_qty = models.IntegerField(null=True, blank=True)
    filter_length = models.CharField(max_length=100, blank=True)
    watts = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    # New specification fields
    cmh_cfm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="CMH/CFM airflow measurement")
    collar_static_pressure = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Static pressure at collar")
    fresh_air_qty = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Fresh air quantity at collar")
    front_panel_thickness = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Front panel thickness")
    skin_type = models.CharField(max_length=20, choices=SKIN_TYPE_CHOICES, blank=True, help_text="Single or double skin")
    make = models.CharField(max_length=255, blank=True, help_text="Manufacturer/brand")
    uv_lamp_cutout = models.CharField(max_length=20, blank=True, help_text="UV Lamp Cutout (610, 842, 1200, 1554)")
    model_type = models.CharField(max_length=10, choices=MODEL_TYPE_CHOICES, blank=True, help_text="Chimney model type (WMSS, WMSP, WMDS, WMC, UVC, ISS, ISP, IDS, IC)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.item_code} - {self.project.project_name}"


