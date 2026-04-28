from django.contrib import admin
from .models import HeroSection, Section, Feature, Testimonial, CallToAction, SiteSettings


@admin.register(HeroSection)
class HeroSectionAdmin(admin.ModelAdmin):
    list_display = ('title', 'cta_text', 'updated_at')
    fieldsets = (
        ('Content', {'fields': ('title', 'subtitle')}),
        ('Call to Action', {'fields': ('cta_text', 'cta_link')}),
        ('Media', {'fields': ('image_url',)}),
    )


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'published', 'order', 'updated_at')
    list_filter = ('published',)
    search_fields = ('title', 'content')
    prepopulated_fields = {'slug': ('title',)}
    ordering = ['order']


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ('title', 'order')
    list_editable = ('order',)
    ordering = ['order']


@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = ('name', 'role', 'order')
    list_editable = ('order',)
    ordering = ['order']


@admin.register(CallToAction)
class CallToActionAdmin(admin.ModelAdmin):
    list_display = ('title', 'position', 'button_text')
    list_filter = ('position',)


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Site Info', {'fields': ('site_name', 'tagline')}),
        ('Branding', {'fields': ('logo_url', 'favicon_url')}),
        ('Contact', {'fields': ('contact_email', 'phone')}),
    )
