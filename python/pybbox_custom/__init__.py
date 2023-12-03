from .bboxConstant import BboxConstant
from .bboxAuth import BboxAuth
from .bboxApiURL import BboxAPIUrl
from .bboxApiCall import BboxApiCall
import json

class Bbox:
    """
    Class to interact with Bouygues Bbox Modem Routeur
    API Reference used for this : https://api.bbox.fr/doc/apirouter/
    """

    def __init__(self, ip=BboxConstant.DEFAULT_LOCAL_IP):
        """
        Initiate a Bbox instance with a default local ip (192.168.1.254)
        :param ip: Ip of the box if you do not want the default one
        :type ip: str
        :return: A Bbox Api Instance
        :rtype: None
        """
        self.bbox_url = BboxAPIUrl(None, None, ip)
        self.bbox_auth = BboxAuth(None, None, False, self.bbox_url.authentication_type)

    @property
    def get_access_type(self):
        """
        Return if the access is made on the local network or remotely
        :return: AUTHENTICATION_TYPE_LOCAL (0) or AUTHENTICATION_TYPE_REMOTE (1)
        :rtype: int
        """
        return self.bbox_url.authentication_type

    """
    USEFUL FUNCTIONS
    """

    """
    DEVICE API
    """

    def get_bbox_info(self):
        """
        This API returns Bbox information
        :return: numbers of info about the box itself (see API doc)
        :rtype: dict
        """
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PUBLIC, BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        self.bbox_url.set_api_name(BboxConstant.API_DEVICE, None)
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_GET, None,
                          self.bbox_auth)
        resp = api.execute_api_request()
        return resp.json()[0]

    def set_display_luminosity(self, luminosity):
        """
        Change the intensity of light of the front panel of the box
        :param luminosity: must be between 0 (light off) and 100
        :type luminosity: int
        """
        if (luminosity < 0) or (luminosity > 100):
            raise ValueError("Luminosity must be between 0 and 100")
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PRIVATE,
                                  BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        self.bbox_url.set_api_name(BboxConstant.API_DEVICE, "display")
        data = {'luminosity': luminosity}
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_PUT, data,
                          self.bbox_auth)
        api.execute_api_request()

    def get_bbox_cpu(self):
        """
        This API returns Bbox cpu information
        :return: numbers of info about the cpu (see API doc)
        :rtype: dict

        .. todo:: make a token class to be able to store date of expiration
        """
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PRIVATE, BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        self.bbox_url.set_api_name(BboxConstant.API_DEVICE, "cpu")
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_GET, None,
                          self.bbox_auth)
        resp = api.execute_api_request()
        return resp.json()[0]['device']['time']

    def get_bbox_mem(self):
        """
        This API returns Bbox memory information
        :return: numbers of info about the memory (see API doc)
        .. fix a bug about committedas is empty 
        :rtype: dict
        """
        token = self.get_token()
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PRIVATE, BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        self.bbox_url.set_api_name(BboxConstant.API_DEVICE, "mem")
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_GET, None, self.bbox_auth)
        resp = api.execute_api_request()
        return json.loads(resp.text.replace('"committedas":', '"committedas":0'))[0]['device']['mem']

    def reboot(self):
        """
        Reboot the device
        Useful when trying to get xDSL sync
        """
        token = self.get_token()
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PRIVATE, BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        url_suffix = "reboot?btoken={}".format(token)
        self.bbox_url.set_api_name(BboxConstant.API_DEVICE, url_suffix)
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_POST, None,
                          self.bbox_auth)
        api.execute_api_request()
        

    def get_token(self):
        """
        Return a string which is a token, needed for some API calls
        :return: Token (can be used with some API call
        :rtype: str

        .. todo:: make a token class to be able to store date of expiration
        """
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PRIVATE, BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        self.bbox_url.set_api_name(BboxConstant.API_DEVICE, "token")
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_GET, None,
                          self.bbox_auth)
        resp = api.execute_api_request()
        return resp.json()[0]['device']['token']

    """
    LAN API
    """

    def get_all_connected_devices(self):
        """
        Get all info about devices connected to the box
        :return: a list with each device info
        :rtype: list
        """
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PUBLIC, BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        self.bbox_url.set_api_name(BboxConstant.API_HOSTS, None)
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_GET, None,
                          self.bbox_auth)
        resp = api.execute_api_request()
        return resp.json()[0]["hosts"]["list"]

    def is_device_connected(self, ip):
        """
        Check if a device identified by it IP is connected to the box
        :param ip: IP of the device you want to test
        :type ip: str
        :return: True is the device is connected, False if it's not
        :rtype: bool
        """
        all_devices = self.get_all_connected_devices()
        for device in all_devices:
            if ip == device['ipaddress']:
                return device['active'] == 1
        return False

    def get_active_hosts_number(self):
        """
        Get the number of active hosts
        :return: the number of active hosts in the LAN
        :rtype: int
        """
        all_devices = self.get_all_connected_devices()
        active = 0
        for h in all_devices:
            if h['active'] != 0:
                active = active + 1
        return active


    """
    USER ACCOUNT
    """

    def login(self, password):
        """
        Authentify yourself against the box,
        :param password: Admin password of the box
        :type password: str
        :return: True if your auth is successful
        :rtype: bool
        """
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PUBLIC, BboxConstant.AUTHENTICATION_LEVEL_PUBLIC)
        self.bbox_url.set_api_name("login", None)
        data = {'password': password}
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_POST, data,
                          self.bbox_auth)
        response = api.execute_api_request()
        if response.status_code == 201:
            self.bbox_auth.set_cookie_id(response.cookies["BBOX_ID"])
        return self.bbox_auth.is_authentified()

    def logout(self):
        """
        Destroy the auth session against the box
        :return: True if your logout is successful
        :rtype: bool
        """
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PUBLIC, BboxConstant.AUTHENTICATION_LEVEL_PUBLIC)
        self.bbox_url.set_api_name("logout", None)
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_POST, None,
                          self.bbox_auth)
        response = api.execute_api_request()
        if response.status_code == 200:
            self.bbox_auth.set_cookie_id(None)
        return not self.bbox_auth.is_authentified()

    """
    WAN API
    """

    def get_wan_ip(self):
        """
        Get all data about your wan connection
        :return: A dict with all data about your wan connection (see API doc)
        :rtype: dict
        """
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PUBLIC, BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        self.bbox_url.set_api_name(BboxConstant.API_WAN, "ip")
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_GET, None,
                          self.bbox_auth)
        resp = api.execute_api_request()
        return resp.json()[0]["wan"]

    def is_bbox_internet(self):
        """
        Check if your internet connection is ok
        :return: True is the box has an internet connection
        :rtype: bool
        """
        wan_info = self.get_wan_ip()
        if wan_info["internet"]['state'] == 2:
            return True
        else:
            return False

    def get_xdsl_info(self):
        """
        Get all data about your xDSL connection
        :return: A dict with all data about your xdsl connection (see API doc)
        :rtype: dict
        """
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PUBLIC, BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        self.bbox_url.set_api_name(BboxConstant.API_WAN, "xdsl")
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_GET, None,
                          self.bbox_auth)
        resp = api.execute_api_request()
        return resp.json()[0]["wan"]["xdsl"]

    def get_xdsl_stats(self):
        """
        Get all stats about your xDSL connection
        :return: A dict with all stats about your xdsl connection (see API doc)
        :rtype: dict
        """
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PUBLIC, BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        self.bbox_url.set_api_name(BboxConstant.API_WAN, "xdsl/stats")
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_GET, None,
                          self.bbox_auth)
        resp = api.execute_api_request()
        return resp.json()[0]["wan"]["xdsl"]["stats"]

    def get_ip_stats(self):
        """
        Get all stats about your Wan ip connection
        :return: A dict with all stats about your Wan ip connection (see API doc)
        :rtype: dict
        """
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PUBLIC, BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        self.bbox_url.set_api_name(BboxConstant.API_WAN, "ip/stats")
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_GET, None,
                          self.bbox_auth)
        resp = api.execute_api_request()
        return resp.json()[0]["wan"]["ip"]["stats"]

    def is_bbox_connected(self):
        """
        Check if your xDsl connection is ok
        :return: True is the box has an xdsl connection
        :rtype: bool
        """
        xdsl_info = self.get_xdsl_info()
        return xdsl_info["state"] == "Connected"

    def get_up_bitrates(self):
        """
        :return: the upload bitrates of the xdsl connectionbitrates in Mbps
        :rtype: float
        """
        xdsl_info = self.get_xdsl_info()
        return xdsl_info["up"]["bitrates"] / 1000

    def get_down_bitrates(self):
        """
        :return: the download bitrates of the xdsl connectionbitrates in Mbps
        :rtype: float
        """
        xdsl_info = self.get_xdsl_info()
        return xdsl_info["down"]["bitrates"] / 1000

    def get_up_used_bandwith(self):
        """
        Return a percentage of the current used wan upload bandwith
        Instant measure, can be very different from one call to another
        :return: 0 no bandwith is used, 100 all your bandwith is used
        :rtype: int
        """
        ip_stats_up = self.get_ip_stats()['tx']
        percent = ip_stats_up['bandwidth']*100/ip_stats_up['maxBandwidth']
        return int(percent)

    def get_down_packets(self):
        """
        Return the down packets used by wan
        :return: down wan packets
        :rtype: int
        """
        return self.get_ip_stats()['rx']['packets']

    def get_up_packets(self):
        """
        Return the up packets used by wan
        :return: down up packets
        :rtype: int
        """
        return self.get_ip_stats()['tx']['packets']

    def get_up_bytes(self):
        """
        :return: the upload bytes of the wan in Mbps
        :rtype: float
        """
        return round(self.get_ip_stats()['tx']['bytes'] / 10**6, 2)

    def get_down_bytes(self):
        """
        :return: the download bytes of the wan in Mbps
        :rtype: float
        """
        return round(self.get_ip_stats()['rx']['bytes'] / 10**6, 2)


    """
    WIFI API
    """

    def get_wireless(self):
        """
        Get all data about your wan connection
        :return: A dict with all data about your wan connection (see API doc)
        :rtype: dict
        """
        self.bbox_auth.set_access(BboxConstant.AUTHENTICATION_LEVEL_PUBLIC, BboxConstant.AUTHENTICATION_LEVEL_PRIVATE)
        self.bbox_url.set_api_name(BboxConstant.API_WIFI, None)
        api = BboxApiCall(self.bbox_url, BboxConstant.HTTP_METHOD_GET, None,
                          self.bbox_auth)
        resp = api.execute_api_request()
        return resp.json()[0]["wireless"]

    def is_wifi_activated(self):
        """
        Get all data about your wan connection
        :return: A dict with all data about your wan connection (see API doc)
        :rtype: dict
        """
        wireless = self.get_wireless()
        if wireless["radio"]["24"]["state"] or wireless["radio"]["5"]["state"]:
            return True
        else:
            return False
